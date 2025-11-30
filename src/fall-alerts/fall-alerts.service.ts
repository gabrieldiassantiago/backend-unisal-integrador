import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
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
import { Logger } from '@nestjs/common';

@Injectable()
export class FallAlertsService {
  private expo: Expo;

  constructor(
    @InjectQueue('fall-alerts') private alertsQueue: Queue,
    private readonly prismaService: PrismaService,
    private readonly gateway: FallAlertsGateway,
    private readonly messagingService: MessagingService,
    private readonly familyService: FamilyService,
    private readonly logger: Logger
  ) {
    this.expo = new Expo();
  }

  /**
   * Enviar notificacao push via Expo Push Service (instavel)
   */

  @Cron(CronExpression.EVERY_5_MINUTES)

  async checkConfirmedAlertsJob() {
    this.logger.log('🕵️ Executando Job: Verificar alertas confirmados...');

    // Buscar alertas CONFIRMED que foram atualizados há mais de 10 minutos
    // (Damos um tempo para o atendimento acontecer antes de cobrar)

    const alerts = await this.prismaService.fallAlert.findMany({
      where: {
        status: 'CONFIRMED',
        // Evitar spam: podemos criar um campo 'lastNotificationSentAt' no banco futuramente
        // Por enquanto, vamos pegar todos os confirmados antigos.
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
      // Prioridade: Mandar para quem respondeu (respondedBy). Se não tiver, manda para o contato 1.
      let targetPhone = null;
      let targetName = 'Cuidador';

      if (alert.respondedBy) {
        const user = await this.prismaService.user.findUnique({ where: { id: alert.respondedBy } });
        if (user?.phone) {
          targetPhone = user.phone;
          targetName = user.name;
        }
      }

      // Fallback: Contato de emergência prioritário
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
        } catch (e) {
          this.logger.error(`Erro ao notificar resolução alerta ${alert.id}: ${e.message}`);
        }
      }
    }
  }

  /**
   * Marcar alerta como RESOLVIDO (Finalizado)
   */
  async markResolved(alertId: string) {
    const alert = await this.prismaService.fallAlert.findUnique({ where: { id: alertId } });
    if (!alert) throw new NotFoundException('Alerta não encontrado');

    const updated = await this.prismaService.fallAlert.update({
      where: { id: alertId },
      data: {
        status: 'RESOLVED',
      },
    });

    this.logger.log(`✅ Alerta ${alertId} marcado como RESOLVED via WhatsApp.`);

    // Emitir socket para atualizar o painel
    this.gateway.emitAlertStatusChange({
      id: updated.id,
      patientId: updated.patientId,
      status: 'RESOLVED',
    });

    return updated;
  }

  private async sendExpoPushNotifications(
    tokens: string[],
    title: string,
    body: string,
    data: any = {}
  ) {
    try {
      const messages: ExpoPushMessage[] = [];

      for (const pushToken of tokens) {
        if (!Expo.isExpoPushToken(pushToken)) {
          console.error(`Token invalido: ${pushToken}`);
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
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          console.log('Push notifications enviadas:', ticketChunk);

          ticketChunk.forEach((ticket, index) => {
            if (ticket.status === 'error') {
              console.error(`Erro no ticket ${index}:`, ticket.message);
            }
          });
        } catch (error) {
          console.error('Erro ao enviar chunk:', error);
        }
      }
    } catch (error) {
      console.error('Erro ao enviar push notifications:', error.message);
    }
  }

  /**
   * Enviar push para todos os usuarios relacionados ao paciente
   */
  private async sendPushNotificationsToRelatedUsers(
    patientId: string,
    patientName: string,
    alertId: string,
    latitude?: number,
    longitude?: number
  ) {
    try {
      console.log(`\n========================================`);
      console.log(`ENVIANDO PUSH NOTIFICATIONS`);
      console.log(`Paciente: ${patientName}`);
      console.log(`Alerta: ${alertId}`);
      console.log(`========================================\n`);

      // Buscar cuidadores relacionados ao paciente
      const caregiverRelations = await this.prismaService.caregiverPatient.findMany({
        where: { patientId },
        include: {
          caregiver: {
            select: {
              id: true,
              name: true,
              pushTokens: {
                select: {
                  token: true
                }
              }
            }
          }
        }
      });

      // Buscar familiares relacionados ao paciente
      const familyRelations = await this.prismaService.familyRelation.findMany({
        where: {
          patientId,
          acceptedAt: { not: null },
          revokedAt: null
        },
        include: {
          familyMember: {
            select: {
              id: true,
              name: true,
              pushTokens: {
                select: {
                  token: true
                }
              }
            }
          }
        }
      });

      const tokens: string[] = [];

      // Coletar tokens dos cuidadores
      caregiverRelations.forEach(relation => {
        relation.caregiver.pushTokens.forEach(pushToken => {
          tokens.push(pushToken.token);
          console.log(`Token adicionado: ${relation.caregiver.name}`);
        });
      });

      // Coletar tokens dos familiares
      familyRelations.forEach(relation => {
        relation.familyMember.pushTokens.forEach(pushToken => {
          tokens.push(pushToken.token);
          console.log(`Token adicionado: ${relation.familyMember.name}`);
        });
      });

      if (tokens.length === 0) {
        console.log('Nenhum token push encontrado');
        return;
      }

      console.log(`Total de tokens: ${tokens.length}`);

      await this.sendExpoPushNotifications(
        tokens,
        'CRITICO - Alerta de Queda',
        `${patientName} pode ter caido!`,
        {
          type: 'fall_alert',
          alertId,
          patientName,
          patientId,
          latitude: latitude?.toString(),
          longitude: longitude?.toString(),
          timestamp: new Date().toISOString(),
        }
      );

      console.log(`Push notifications enviadas com sucesso!\n`);
    } catch (error) {
      console.error('Erro ao enviar push notifications:', error);
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
          }
        }
      }
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
        status: true
      }
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

    //  EMITIR WEBSOCKET IMEDIATAMENTE (SÍNCRONO)
    console.log('🚀 Emitindo WebSocket newAlert IMEDIATAMENTE...');
    this.gateway.emitNewAlert(payload);
    console.log('✅ WebSocket newAlert emitido!');

    //  PUSH NOTIFICATIONS IMEDIATO (não espera)
    this.sendPushNotificationsToRelatedUsers(
      device.patientId,
      device.patient.name,
      alert.id,
      alert.latitude,
      alert.longitude
    ).catch(err => console.error('Erro ao enviar push:', err));

    //  Jobs em background (sem delay inicial para jobs críticos)
    Promise.all([
      // Job de WhatsApp + Chamada - SEM DELAY
      this.alertsQueue.add(
        'processInitialAlert',
        {
          alertId: alert.id,
          patientId: device.patientId,
          latitude: data.latitude,
          longitude: data.longitude
        },
        { priority: 10 } // Removido delay
      ),

      // Notificar contatos secundários após 3 minutos
      this.alertsQueue.add(
        'notifySecondaryContacts',
        {
          alertId: alert.id,
          patientId: device.patientId,
          latitude: data.latitude,
          longitude: data.longitude
        },
        { delay: 180000 }
      ),

      // Auto-confirmar após 5 minutos
      this.alertsQueue.add(
        'autoConfirm',
        { alertId: alert.id },
        { delay: 300000 }
      )
    ]).catch(err => console.error('Erro ao agendar jobs:', err));

    console.log(`✅ Alerta ${alert.id} criado! WebSocket emitido + Jobs agendados.`);

    return payload;
  }

  /**
   * Verificar se usuario pode responder alerta
   */

  private async canUserRespondAlert(userId: string, patientId: string): Promise<boolean> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) return false;

    if (user.role === 'CAREGIVER') {
      const caregiverPatient = await this.prismaService.caregiverPatient.findUnique({
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
      const permissions = await this.familyService.getFamilyPermissions(userId, patientId);
      return permissions?.canRespondAlerts ?? false;
    }

    return false;
  }

  /**
   * Marcar alerta como FALSO ALARME
   */

  async markFalseAlarm(alertId: string, caregiverId: string) {
    try {
      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
        include: { patient: true },
      });

      if (!alert) throw new alertNoExisting(alertId);

      if (alert.status !== 'PENDING' && alert.status !== 'VERIFYING') {
        throw new BadRequestException('Alerta ja foi processado');
      }

      const canRespond = await this.canUserRespondAlert(caregiverId, alert.patientId);
      if (!canRespond) {
        throw new ForbiddenException('Voce nao tem permissao para responder este alerta');
      }

      const caregiver = await this.prismaService.user.findUnique({
        where: { id: caregiverId },
      });

      if (!caregiver) {
        throw new BadRequestException(`Usuario nao encontrado: ${caregiverId}`);
      }

      const updated = await this.prismaService.fallAlert.update({
        where: { id: alertId },
        data: {
          status: 'FALSE_ALARM',
          respondedBy: caregiverId,
          respondedAt: new Date(),
        },
      });

      console.log(`Alerta ${alertId} marcado como FALSE_ALARM por ${caregiver.name}`);

      try {
        const allContacts = await this.prismaService.emergencyContact.findMany({
          where: { patientId: alert.patientId },
        });

        for (const contact of allContacts) {
          try {
            await this.messagingService.sendFalseAlarm(
              contact.phone,
              alert.patient.name,
              caregiver.name
            );
            console.log(`WhatsApp enviado para ${contact.name}`);
          } catch (whatsappError) {
            console.error(`Erro ao enviar WhatsApp para ${contact.name}:`, whatsappError.message);
          }
        }
      } catch (notifyError) {
        console.error('Erro ao notificar cuidadores:', notifyError.message);
      }

      try {
        this.gateway.emitAlertStatusChange({
          id: updated.id,
          patientId: updated.patientId,
          status: updated.status,
          respondedBy: caregiverId,
        });
        console.log(`WebSocket emitido para alerta ${alertId}`);
      } catch (wsError) {
        console.error('Erro ao emitir WebSocket:', wsError.message);
      }

      try {
        const jobs = await this.alertsQueue.getJobs(['delayed']);
        let canceledCount = 0;

        for (const job of jobs) {
          if (job.data.alertId === alertId) {
            console.log(`Cancelando job ${job.id} (${job.name})`);
            await job.remove();
            canceledCount++;
          }
        }

        console.log(`${canceledCount} jobs cancelados`);
      } catch (queueError) {
        console.error('Erro ao cancelar jobs:', queueError.message);
      }

      return {
        id: updated.id,
        caregiverId: caregiverId,
        status: updated.status
      };
    } catch (error) {
      console.error('Erro em markFalseAlarm:', error);

      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }

      throw new InternalServerErrorException('Erro ao marcar alerta como falso alarme');
    }
  }

  /**
   * Marcar alerta como VERIFICANDO
   */

  /**
  * Marcar alerta como VERIFICANDO
  *
  * Comportamento corrigido:
  * - `caregiverId` é tratado como ID do USUÁRIO (cuidador OU familiar).
  * - Atualiza o alerta para VERIFYING e seta respondedBy = caregiverId.
  * - Emite evento WebSocket para a sala do paciente.
  * - Cancela jobs de notifySecondaryContacts agendados.
  * - Agenda job 'requestConfirmation' passando caregiverId (userId) para que o processador envie a confirmação ao próprio respondente.
  * - Envia o lembrete (WhatsApp COM BOTÕES) para o TELEFONE do usuário que respondeu.
  *   - Se o usuário não tiver telefone cadastrado, faz fallback para o contato de emergência prioritário do paciente.
  */
  async markVerifying(alertId: string, caregiverId: string) {
    try {
      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
        include: { patient: true },
      });

      if (!alert) throw new alertNoExisting(alertId);

      if (alert.status !== 'PENDING') {
        throw new BadRequestException('Alerta ja foi processado');
      }

      const canRespond = await this.canUserRespondAlert(caregiverId, alert.patientId);
      if (!canRespond) {
        throw new ForbiddenException('Voce nao tem permissao para responder este alerta');
      }

      // Buscar o usuário (cuidador OU familiar) que está respondendo
      const respondingUser = await this.prismaService.user.findUnique({
        where: { id: caregiverId },
        select: { id: true, name: true, phone: true, role: true },
      });

      const verificationDeadline = new Date(Date.now() + 120000); // 2 minutos
      const updated = await this.prismaService.fallAlert.update({
        where: { id: alertId },
        data: {
          status: 'VERIFYING',
          respondedBy: caregiverId,
          respondedAt: new Date(),
          verificationDeadline,
        },
      });

      console.log(`Alerta ${alertId} marcado como VERIFYING por ${respondingUser?.name ?? caregiverId}`);

      // Emitir atualização via WebSocket
      try {
        this.gateway.emitAlertStatusChange({
          id: updated.id,
          patientId: updated.patientId,
          status: updated.status,
          respondedBy: caregiverId,
          verificationDeadline,
        });
      } catch (wsError) {
        console.error('Erro ao emitir WebSocket:', wsError.message);
      }

      // Cancelar jobs notifySecondaryContacts relacionados a este alerta (se existirem)
      try {
        const jobs = await this.alertsQueue.getJobs(['delayed']);
        for (const job of jobs) {
          if (job.data.alertId === alertId && job.name === 'notifySecondaryContacts') {
            await job.remove();
            console.log(`Job notifySecondaryContacts cancelado`);
          }
        }
      } catch (queueError) {
        console.error('Erro ao cancelar jobs:', queueError.message);
      }

      // Agendar job requestConfirmation passando caregiverId (userId) para que a fila saiba
      try {
        await this.alertsQueue.add(
          'requestConfirmation',
          { alertId: alert.id, caregiverId },
          { delay: 10000 }, // 10s
        );
        console.log(`Job requestConfirmation agendado para 10s`);
      } catch (queueError) {
        console.error('Erro ao agendar job:', queueError.message);
      }

      // Preparar link de localização
      const googleMapsLink = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;

      // Enviar lembrete COM BOTÕES preferencialmente para o telefone do usuário que respondeu
      try {
        if (respondingUser?.phone) {
          console.log(`[markVerifying] Enviando lembrete para o usuário respondente: ${respondingUser.name} (${respondingUser.phone})`);
          await this.messagingService.sendVerificationReminderWithButtons({
            to: respondingUser.phone,
            alertId: alert.id,
            patientName: alert.patient.name,
            location: googleMapsLink,
            contactName: respondingUser.name,
          });
          console.log(`[markVerifying] WhatsApp com BOTÕES enviado para ${respondingUser.name}`);
        } else {
          // Fallback: usar contato de emergência prioritário
          const priorityContact = await this.prismaService.emergencyContact.findFirst({
            where: { patientId: alert.patientId, priority: 1 },
          });

          if (priorityContact) {
            console.log(`[markVerifying] Usuario sem telefone. Usando contato prioritário: ${priorityContact.name} (${priorityContact.phone})`);
            await this.messagingService.sendVerificationReminderWithButtons({
              to: priorityContact.phone,
              alertId: alert.id,
              patientName: alert.patient.name,
              location: googleMapsLink,
              contactName: priorityContact.name,
            });
            console.log(`[markVerifying] WhatsApp com BOTÕES enviado para contato prioritário ${priorityContact.name}`);
          } else {
            console.log('[markVerifying] Nenhum telefone disponível para notificação (respondente sem telefone e sem contato prioritário).');
          }
        }
      } catch (notifyError) {
        console.error('Erro ao enviar lembrete/verificacao:', notifyError.message);
      }

      return updated;
    } catch (error) {
      console.error('Erro em markVerifying:', error);

      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }

      throw new InternalServerErrorException('Erro ao marcar alerta como verificando');
    }
  }
  /**
   * Confirmar emergencia apos verificacao
   */

  async confirmAfterVerification(alertId: string, caregiverId: string) {
    try {
      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
        include: { patient: true },
      });

      if (!alert) throw new alertNoExisting(alertId);
      if (alert.status !== 'VERIFYING') {
        throw new BadRequestException('Alerta nao esta em verificacao');
      }

      const canRespond = await this.canUserRespondAlert(caregiverId, alert.patientId);
      if (!canRespond) {
        throw new ForbiddenException('Voce nao tem permissao para responder este alerta');
      }

      const caregiver = await this.prismaService.user.findUnique({
        where: { id: caregiverId },
      });

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
              contact.priority
            );
            console.log(`WhatsApp de emergencia confirmada enviado para ${contact.name}`);
          } catch (whatsappError) {
            console.error(`Erro ao enviar WhatsApp:`, whatsappError.message);
          }
        }
      } catch (notifyError) {
        console.error('Erro ao notificar:', notifyError.message);
      }

      return this.confirmAlert(alertId);
    } catch (error) {
      console.error('Erro em confirmAfterVerification:', error);

      if (error instanceof NotFoundException || error instanceof BadRequestException || error instanceof ForbiddenException) {
        throw error;
      }

      throw new InternalServerErrorException('Erro ao confirmar alerta apos verificacao');
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

    const googleMapsLink = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;

    const contatos = await this.prismaService.emergencyContact.findMany({
      where: { patientId: alert.patientId },
      select: { id: true, phone: true, name: true, priority: true },
      orderBy: { priority: 'asc' },
    });

    if (contatos.length === 0) {
      throw new BadRequestException('Nenhum contato de emergencia encontrado.');
    }

    console.log(`\n========================================`);
    console.log(`ALERTA CONFIRMADO: ${alertId}`);
    console.log(`Paciente: ${alert.patient.name}`);
    console.log(`Notificando ${contatos.length} contatos...`);
    console.log(`========================================\n`);

    for (const contact of contatos) {
      try {
        await this.messagingService.sendEmergencyConfirmed(
          contact.phone,
          alert.patient.name,
          googleMapsLink,
          contact.name,
          contact.priority
        );
        console.log(`WhatsApp enviado para ${contact.name} (prioridade ${contact.priority})`);
      } catch (err) {
        console.error(`Erro ao enviar WhatsApp para ${contact.name}:`, err.message);
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

    console.log(`Alerta ${alertId} confirmado e notificacoes enviadas!\n`);

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
      orderBy: { createdAt: 'desc' }
    })

    const count = await this.prismaService.fallAlert.count({
      where: { patientId }
    })

    return { alerts, count };

  }
}