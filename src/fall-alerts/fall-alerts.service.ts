import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FallAlertsGateway } from './fall-alerts.gateway';
import { CreateFallAlertDto } from './dtos/create-fall-alert.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { alertNoExisting } from '@src/errors/alertNoExistint';
import { FamilyService } from '@src/family/family.service';
import { MessagingService } from '@src/messaging/messaging.service';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';
import { DeviceNotFoundException } from '@src/common/exceptions/custom.exceptions';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class FallAlertsService {
  private expo: Expo;
  private readonly logger = new Logger(FallAlertsService.name);

  constructor(
    @InjectQueue('fall-alerts') private alertsQueue: Queue,
    private readonly prismaService: PrismaService,
    private readonly gateway: FallAlertsGateway,
    private readonly messagingService: MessagingService,
    private readonly familyService: FamilyService,
  ) {
    this.expo = new Expo();
  }

  /**
   * Verificar alertas confirmados antigos
   */
  //@Cron(CronExpression.EVERY_5_MINUTES)
  async checkConfirmedAlertsJob() {
    this.logger.log('🕵️ Executando Job: Verificar alertas confirmados...');

    const alerts = await this.prismaService.fallAlert.findMany({
      where: {
        status: 'CONFIRMED',
      },
      include: {
        patient: true,
      },
    });

    if (alerts.length === 0) {
      this.logger.log('✅ Nenhum alerta confirmado pendente de verificação.');
      return;
    }

    this.logger.log(`⚠️ Encontrados ${alerts.length} alertas confirmados antigos.`);

    for (const alert of alerts) {
      let targetPhone: string | null = null;
      let targetName = 'Cuidador';

      if (alert.respondedBy) {
        const user = await this.prismaService.user.findUnique({
          where: { id: alert.respondedBy },
        });
        if (user?.phone) {
          targetPhone = user.phone;
          targetName = user.name;
        }
      }

      if (!targetPhone) {
        const contact = await this.prismaService.emergencyContact.findFirst({
          where: { patientId: alert.patientId },
          orderBy: { priority: 'asc' },
        });
        if (contact) {
          targetPhone = contact.phone;
          targetName = contact.name;
        }
      }

      if (targetPhone) {
        try {
          await this.messagingService.sendResolutionCheck({
            to: targetPhone,
            alertId: alert.id,
            patientName: alert.patient.name,
            contactName: targetName,
          });
        } catch (e: any) {
          this.logger.error(
            `Erro ao notificar resolução alerta ${alert.id}: ${e.message}`,
          );
        }
      }
    }
  }

  /**
   * Marcar alerta como RESOLVIDO (Finalizado)
   * REFATORADO: Agora notifica via Push
   */
  async markResolved(alertId: string) {
    const alert = await this.prismaService.fallAlert.findUnique({
      where: { id: alertId },
      include: { patient: true },
    });

    if (!alert) throw new NotFoundException('Alerta não encontrado');

    const updated = await this.prismaService.fallAlert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
      },
    });

    this.logger.log(`✅ Alerta ${alertId} marcado como RESOLVED via WhatsApp.`);

    this.gateway.emitAlertStatusChange({
      id: updated.id,
      patientId: updated.patientId,
      status: 'RESOLVED',
    });

    this.sendPushNotificationsToRelatedUsers(
      updated.patientId,
      alert.patient.name,
      updated.id,
      'Atendimento Finalizado',
      `A situação com ${alert.patient.name} foi resolvida.`,
      'resolved',
      alert.latitude,
      alert.longitude,
    ).catch((err) =>
      this.logger.error('Erro ao enviar push de resolvido:', err),
    );

    return updated;
  }

  private async sendExpoPushNotifications(
    tokens: string[],
    title: string,
    body: string,
    data: any = {},
  ) {
    try {
      const messages: ExpoPushMessage[] = [];

      for (const pushToken of tokens) {
        if (!Expo.isExpoPushToken(pushToken)) {
          this.logger.error(`Token invalido: ${pushToken}`);
          continue;
        }

        messages.push({
          to: pushToken,
          sound: 'default',
          title,
          body,
          data,
          priority: 'high',
          channelId: 'alerta-queda',
        });
      }

      const chunks = this.expo.chunkPushNotifications(messages);

      for (const chunk of chunks) {
        try {
          const ticketChunk =
            await this.expo.sendPushNotificationsAsync(chunk);
          this.logger.log('Push notifications enviadas:', ticketChunk);

          ticketChunk.forEach((ticket, index) => {
            if (ticket.status === 'error') {
              this.logger.error(`Erro no ticket ${index}:`, ticket.message);
            }
          });
        } catch (error) {
          this.logger.error('Erro ao enviar chunk:', error);
        }
      }
    } catch (error: any) {
      this.logger.error('Erro ao enviar push notifications:', error.message);
    }
  }

  /**
   * Enviar push para todos os usuarios relacionados ao paciente
   */
  private async sendPushNotificationsToRelatedUsers(
    patientId: string,
    patientName: string,
    alertId: string,
    title: string,
    body: string,
    type: string, // 'fall_alert', 'false_alarm', 'resolved'
    latitude?: number,
    longitude?: number,
  ) {
    try {
      this.logger.log(`\n=== ENVIANDO PUSH (${type}) ===`);
      this.logger.log(`Paciente: ${patientName} | Alerta: ${alertId}`);

      const caregiverRelations =
        await this.prismaService.caregiverPatient.findMany({
          where: { patientId },
          include: {
            caregiver: {
              select: {
                id: true,
                name: true,
                pushTokens: { select: { token: true } },
              },
            },
          },
        });

      const familyRelations =
        await this.prismaService.familyRelation.findMany({
          where: {
            patientId,
            acceptedAt: { not: null },
            revokedAt: null,
          },
          include: {
            familyMember: {
              select: {
                id: true,
                name: true,
                pushTokens: { select: { token: true } },
              },
            },
          },
        });

      const tokens: string[] = [];

      caregiverRelations.forEach((relation) => {
        relation.caregiver.pushTokens.forEach((pushToken) =>
          tokens.push(pushToken.token),
        );
      });

      familyRelations.forEach((relation) => {
        relation.familyMember.pushTokens.forEach((pushToken) =>
          tokens.push(pushToken.token),
        );
      });

      if (tokens.length === 0) {
        this.logger.warn('Nenhum token push encontrado');
        return;
      }

      await this.sendExpoPushNotifications(tokens, title, body, {
        type,
        alertId,
        patientName,
        patientId,
        latitude: latitude?.toString(),
        longitude: longitude?.toString(),
        timestamp: new Date().toISOString(),
      });

      this.logger.log(`Push notifications enviadas com sucesso!\n`);
    } catch (error) {
      this.logger.error('Erro ao enviar push notifications:', error);
    }
  }

  /**
   * Criar novo alerta de queda
   */
  async createAlert(data: CreateFallAlertDto) {
    const device = await this.prismaService.device.findUnique({
      where: { deviceIdentifier: data.serial },
      select: {
        id: true,
        patientId: true,
        apiKeyHash: true,
        deviceIdentifier: true,
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!device) {
      throw new DeviceNotFoundException(data.serial);
    }

    const alert = await this.prismaService.fallAlert.create({
      data: {
        deviceId: device.id,
        patientId: device.patientId,
        latitude: data.latitude,
        longitude: data.longitude,
        status: 'PENDING',
      },
      select: {
        id: true,
        deviceId: true,
        patientId: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        status: true,
      },
    });

    const payload = {
      id: alert.id,
      deviceId: alert.deviceId,
      patientId: alert.patientId,
      latitude: alert.latitude,
      longitude: alert.longitude,
      createdAt: alert.createdAt,
      statusAlert: alert.status,
    };

    this.logger.log('🚀 Emitindo WebSocket newAlert IMEDIATAMENTE...');
    this.gateway.emitNewAlert(payload);

    this.sendPushNotificationsToRelatedUsers(
      device.patientId,
      device.patient.name,
      alert.id,
      'CRITICO - Alerta de Queda',
      `${device.patient.name} pode ter caido!`,
      'fall_alert',
      alert.latitude,
      alert.longitude,
    ).catch((err) => this.logger.error('Erro ao enviar push:', err));

    Promise.all([
      this.alertsQueue.add(
        'processInitialAlert',
        {
          alertId: alert.id,
          patientId: device.patientId,
          latitude: data.latitude,
          longitude: data.longitude,
        },
        { priority: 10 },
      ),
      this.alertsQueue.add(
        'notifySecondaryContacts',
        {
          alertId: alert.id,
          patientId: device.patientId,
          latitude: data.latitude,
          longitude: data.longitude,
        },
        { delay: 180000 },
      ),
      this.alertsQueue.add(
        'autoConfirm',
        { alertId: alert.id },
        { delay: 300000 },
      ),
    ]).catch((err) => this.logger.error('Erro ao agendar jobs:', err));

    this.logger.log(
      `✅ Alerta ${alert.id} criado! WebSocket emitido + Jobs agendados.`,
    );

    return payload;
  }

  private async canUserRespondAlert(
    userId: string,
    patientId: string,
  ): Promise<boolean> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) return false;

    if (user.role === 'CAREGIVER') {
      const caregiverPatient =
        await this.prismaService.caregiverPatient.findUnique({
          where: {
            caregiverId_patientId: {
              caregiverId: userId,
              patientId: patientId,
            },
          },
        });
      return !!caregiverPatient;
    }

    if (user.role === 'FAMILY_MEMBER') {
      const permissions = await this.familyService.getFamilyPermissions(
        userId,
        patientId,
      );
      return permissions?.canRespondAlerts ?? false;
    }

    return false;
  }

  /**
   * Marcar alerta como FALSO ALARME
   * - App: usa caregiverId, respondedBy, permissões
   * - WhatsApp: fromWhatsApp = true → NÃO usa respondedBy
   */
  async markFalseAlarm(
    alertId: string,
    caregiverId?: string | null,
    fromWhatsApp = false,
  ) {
    try {
      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
        include: { patient: true },
      });

      if (!alert) throw new alertNoExisting(alertId);

      if (['FALSE_ALARM', 'CONFIRMED', 'RESOLVED'].includes(alert.status)) {
        throw new BadRequestException('Este alerta já foi encerrado');
      }

      let caregiver: { name: string } | null = null;

      if (!fromWhatsApp) {
        if (!caregiverId) {
          throw new BadRequestException('CaregiverId é obrigatório');
        }

        const canRespond = await this.canUserRespondAlert(
          caregiverId,
          alert.patientId,
        );
        if (!canRespond) {
          throw new ForbiddenException(
            'Voce nao tem permissao para responder este alerta',
          );
        }

        caregiver = await this.prismaService.user.findUnique({
          where: { id: caregiverId },
        });

        if (!caregiver) {
          throw new BadRequestException(`Usuario nao encontrado: ${caregiverId}`);
        }
      }

      const caregiverName = caregiver?.name ?? 'um responsável';

      const dataUpdate: any = {
        status: 'FALSE_ALARM',
        respondedAt: new Date(),
      };

      if (!fromWhatsApp && caregiverId) {
        dataUpdate.respondedBy = caregiverId;
      }

      const updated = await this.prismaService.fallAlert.update({
        where: { id: alertId },
        data: dataUpdate,
      });

      this.logger.log(
        `Alerta ${alertId} marcado como FALSE_ALARM por ${caregiverName}`,
      );

      this.sendPushNotificationsToRelatedUsers(
        alert.patientId,
        alert.patient.name,
        alertId,
        'Falso Alarme Informado',
        `O alerta de ${alert.patient.name} foi cancelado por ${caregiverName}. Está tudo bem.`,
        'false_alarm',
        alert.latitude,
        alert.longitude,
      ).catch((err) =>
        this.logger.error('Erro ao enviar push de falso alarme:', err),
      );

      try {
        const allContacts = await this.prismaService.emergencyContact.findMany({
          where: { patientId: alert.patientId },
          orderBy: { priority: 'asc' },
        });

        for (const contact of allContacts) {
          try {
            if (contact.priority === 1) {
              try {
                await this.messagingService.sendFalseAlarm(
                  contact.phone,
                  'Recebemos sua mensagem, obrigado por avisar a gente que foi um falso alarme',
                );
              } catch (whatsappError: any) {
                this.logger.error(
                  `Erro ao enviar WhatsApp para ${contact.name}:`,
                  whatsappError.message,
                );
              }
            }

            const buscarTempoAlerta =
              await this.prismaService.fallAlert.findUnique({
                where: { id: alertId },
              });

            const alertTime = buscarTempoAlerta.createdAt.toLocaleString(
              'pt-BR',
              {
                timeZone: 'America/Sao_Paulo',
              },
            );

            const msg =
              `Se você está recebendo esta mensagem, é porque ` +
              `${alert.patient.name} teve um alerta de possível queda às ${alertTime}, ` +
              `mas já recebeu atendimento.
\n` +
              `Para saber mais informações, entre em contato com ${caregiverName}.\n` +
              `Fique tranquilo(a).`;

            await this.messagingService.sendFalseAlarm(contact.phone, msg);
            this.logger.log(`WhatsApp enviado para ${contact.name}`);
          } catch (whatsappError: any) {
            this.logger.error(
              `Erro ao enviar WhatsApp para ${contact.name}:`,
              whatsappError.message,
            );
          }
        }
      } catch (notifyError: any) {
        this.logger.error(
          'Erro ao notificar cuidadores:',
          notifyError.message,
        );
      }

      try {
        const wsPayload: any = {
          id: updated.id,
          patientId: updated.patientId,
          status: updated.status,
        };
        if (!fromWhatsApp && caregiverId) {
          wsPayload.respondedBy = caregiverId;
        }
        this.gateway.emitAlertStatusChange(wsPayload);
      } catch (wsError: any) {
        this.logger.error('Erro ao emitir WebSocket:', wsError.message);
      }

      try {
        const jobs = await this.alertsQueue.getJobs(['delayed']);
        let canceledCount = 0;

        for (const job of jobs) {
          if (job.data.alertId === alertId) {
            await job.remove();
            canceledCount++;
          }
        }
        this.logger.log(`${canceledCount} jobs cancelados`);
      } catch (queueError: any) {
        this.logger.error('Erro ao cancelar jobs:', queueError.message);
      }

      return {
        id: updated.id,
        caregiverId: fromWhatsApp ? null : caregiverId,
        status: updated.status,
      };
    } catch (error) {
      this.logger.error('Erro em markFalseAlarm:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Erro ao marcar alerta como falso alarme',
      );
    }
  }

  /**
   * Marcar alerta como VERIFICANDO
   * - App: usa caregiverId, respondedBy, permissões
   * - WhatsApp: fromWhatsApp = true → não usa respondedBy, nem reminder direto pro usuário
   */
  async markVerifying(
    alertId: string,
    caregiverId?: string | null,
    fromWhatsApp = false,
  ) {
    try {
      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
        include: { patient: true },
      });

      if (!alert) throw new alertNoExisting(alertId);

      if (['FALSE_ALARM', 'CONFIRMED', 'RESOLVED'].includes(alert.status)) {
        throw new BadRequestException(
          'Este alerta já foi encerrado e não pode ser alterado',
        );
      }

      if (!fromWhatsApp) {
        if (!caregiverId) {
          throw new BadRequestException('CaregiverId é obrigatório');
        }

        if (
          alert.status === 'VERIFYING' &&
          alert.respondedBy &&
          alert.respondedBy !== caregiverId
        ) {
          throw new ForbiddenException(
            'Outra pessoa já está verificando este alerta',
          );
        }

        if (alert.status !== 'PENDING') {
          throw new BadRequestException('Alerta ja foi processado');
        }

        const canRespond = await this.canUserRespondAlert(
          caregiverId,
          alert.patientId,
        );
        if (!canRespond) {
          throw new ForbiddenException(
            'Voce nao tem permissao para responder este alerta',
          );
        }
      } else {
        // from WhatsApp: ainda exigimos que esteja PENDING
        if (alert.status !== 'PENDING') {
          throw new BadRequestException('Alerta ja foi processado');
        }
      }

      const respondingUser = !fromWhatsApp && caregiverId
        ? await this.prismaService.user.findUnique({
          where: { id: caregiverId },
          select: { id: true, name: true, phone: true, role: true },
        })
        : null;

      const verificationDeadline = new Date(Date.now() + 120000); // 2 minutos

      const dataUpdate: any = {
        status: 'VERIFYING',
        respondedAt: new Date(),
        verificationDeadline,
      };
      if (!fromWhatsApp && caregiverId) {
        dataUpdate.respondedBy = caregiverId;
      }

      const updated = await this.prismaService.fallAlert.update({
        where: { id: alertId },
        data: dataUpdate,
      });

      this.logger.log(
        `Alerta ${alertId} marcado como VERIFYING por ${respondingUser?.name ?? 'respondente'
        }`,
      );

      try {
        const wsPayload: any = {
          id: updated.id,
          patientId: updated.patientId,
          status: updated.status,
          verificationDeadline,
        };
        if (!fromWhatsApp && caregiverId) {
          wsPayload.respondedBy = caregiverId;
        }
        this.gateway.emitAlertStatusChange(wsPayload);
      } catch (wsError: any) {
        this.logger.error('Erro ao emitir WebSocket:', wsError.message);
      }

      try {
        const jobs = await this.alertsQueue.getJobs([
          'delayed',
          'waiting',
          'active',
        ]);

        for (const job of jobs) {
          if (job.data?.alertId === alertId) {
            await job.remove();
            this.logger.log(`🛑 Job ${job.name} cancelado`);
          }
        }
      } catch (err: any) {
        this.logger.error('Erro ao cancelar jobs:', err.message);
      }

      // 🟢 SOMENTE APP: agendar requestConfirmation + enviar lembrete imediato
      if (!fromWhatsApp && caregiverId) {
        try {
          await this.alertsQueue.add(
            'requestConfirmation',
            { alertId: alert.id, caregiverId },
            { delay: 10000 },
          );
        } catch (queueError: any) {
          this.logger.error('Erro ao agendar job:', queueError.message);
        }

        const googleMapsLink = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;

        try {
          if (respondingUser?.phone) {
            await this.messagingService.sendVerificationReminderWithButtons({
              to: respondingUser.phone,
              alertId: alert.id,
              patientName: alert.patient.name,
              location: googleMapsLink,
              contactName: respondingUser.name,
            });
          } else {
            const priorityContact =
              await this.prismaService.emergencyContact.findFirst({
                where: { patientId: alert.patientId, priority: 1 },
              });

            if (priorityContact) {
              await this.messagingService.sendVerificationReminderWithButtons({
                to: priorityContact.phone,
                alertId: alert.id,
                patientName: alert.patient.name,
                location: googleMapsLink,
                contactName: priorityContact.name,
              });
            }
          }
        } catch (notifyError: any) {
          this.logger.error(
            'Erro ao enviar lembrete/verificacao:',
            notifyError.message,
          );
        }
      }

      return updated;
    } catch (error) {
      this.logger.error('Erro em markVerifying:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Erro ao marcar alerta como verificando',
      );
    }
  }

  /**
   * Confirmar emergencia apos verificacao
   * - App: valida caregiverId
   * - WhatsApp: fromWhatsApp = true → não exige caregiverId
   */
  async confirmAfterVerification(
    alertId: string,
    caregiverId?: string | null,
    fromWhatsApp = false,
  ) {
    try {
      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
        include: { patient: true },
      });

      if (!alert) throw new alertNoExisting(alertId);

      if (['FALSE_ALARM', 'CONFIRMED', 'RESOLVED'].includes(alert.status)) {
        throw new BadRequestException('Este alerta já foi encerrado');
      }

      if (alert.status !== 'VERIFYING') {
        throw new BadRequestException('Alerta nao esta em verificacao');
      }

      if (!fromWhatsApp) {
        if (!caregiverId) {
          throw new BadRequestException('CaregiverId é obrigatório');
        }

        const canRespond = await this.canUserRespondAlert(
          caregiverId,
          alert.patientId,
        );
        if (!canRespond) {
          throw new ForbiddenException(
            'Voce nao tem permissao para responder este alerta',
          );
        }
      }

      try {
        const googleMapsLink = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;
        const allContacts = await this.prismaService.emergencyContact.findMany({
          where: { patientId: alert.patientId },
        });

        for (const contact of allContacts) {
          try {
            await this.messagingService.sendEmergencyConfirmed(
              contact.phone,
              alert.patient.name,
              googleMapsLink,
              contact.name,
              contact.priority,
            );
          } catch (whatsappError: any) {
            this.logger.error(
              `Erro ao enviar WhatsApp:`,
              whatsappError.message,
            );
          }
        }
      } catch (notifyError: any) {
        this.logger.error('Erro ao notificar:', notifyError.message);
      }

      return this.confirmAlert(alertId);
    } catch (error) {
      this.logger.error('Erro em confirmAfterVerification:', error);
      if (
        error instanceof NotFoundException ||
        error instanceof BadRequestException ||
        error instanceof ForbiddenException
      ) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Erro ao confirmar alerta apos verificacao',
      );
    }
  }

  /**
   * Confirmar alerta (auto ou manual)
   */
  async confirmAlert(alertId: string) {
    const alert = await this.prismaService.fallAlert.findUnique({
      where: { id: alertId },
      include: { patient: true },
    });

    if (!alert) throw new alertNoExisting(alertId);

    if (['FALSE_ALARM', 'CONFIRMED', 'RESOLVED'].includes(alert.status)) {
      throw new BadRequestException('Este alerta já está finalizado');
    }

    const googleMapsLink = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;

    const contatos = await this.prismaService.emergencyContact.findMany({
      where: { patientId: alert.patientId },
      select: { id: true, phone: true, name: true, priority: true },
      orderBy: { priority: 'asc' },
    });

    if (contatos.length === 0) {
      throw new BadRequestException('Nenhum contato de emergencia encontrado.');
    }

    this.logger.log(`\n=== ALERTA CONFIRMADO: ${alertId} ===`);

    for (const contact of contatos) {
      try {
        await this.messagingService.sendEmergencyConfirmed(
          contact.phone,
          alert.patient.name,
          googleMapsLink,
          contact.name,
          contact.priority,
        );
      } catch (err: any) {
        this.logger.error(
          `Erro ao enviar WhatsApp para ${contact.name}:`,
          err.message,
        );
      }
    }

    const updated = await this.prismaService.fallAlert.update({
      where: { id: alertId },
      data: { status: 'CONFIRMED' },
    });

    const payload = {
      id: updated.id,
      patientId: updated.patientId,
      status: updated.status,
    };

    this.gateway.emitConfirmed(payload);

    return payload;
  }

  /**
   * Listar alertas de um paciente
   */
  async getAlertsByPatient(patientId: string, page: number, perPage: number) {
    const alerts = await this.prismaService.fallAlert.findMany({
      where: { patientId },
      take: perPage,
      skip: (page - 1) * perPage,
      orderBy: { createdAt: 'desc' },
    });

    const count = await this.prismaService.fallAlert.count({
      where: { patientId },
    });

    return { alerts, count };
  }
}
