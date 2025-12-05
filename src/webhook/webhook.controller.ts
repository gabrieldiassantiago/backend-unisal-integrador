import { Controller, Post, Body, Logger, Headers } from '@nestjs/common';
import { FallAlertsService } from '../fall-alerts/fall-alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingService } from '@src/messaging/messaging.service';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly fallAlertsService: FallAlertsService,
    private readonly prismaService: PrismaService,
    private readonly messagingService: MessagingService,
  ) {}

  @Post('evolution')
  async handleEvolutionWebhook(@Body() payload: any, @Headers() headers: any) {
    try {
      const { event, data } = payload;

      if (event === 'messages.upsert') {
        return await this.handleMessageReceived(data);
      }

      if (event === 'messages.update') {
        return await this.handleMessageUpdate(data);
      }

      return { status: 'ignored', event };
    } catch (error: any) {
      this.logger.error('Erro ao processar webhook:', error.message);
      return { status: 'error', message: error.message };
    }
  }

  private async handleMessageReceived(data: any) {
    try {
      const messages = Array.isArray(data) ? data : [data];

      for (const messageData of messages) {
        const message = messageData?.message;
        const key = messageData?.key;

        if (!message || !key) continue;
        if (key?.fromMe) continue;

        const remoteJid = key?.remoteJid;
        const phoneNumber = remoteJid?.replace('@s.whatsapp.net', '');

        this.logger.log(`Mensagem recebida de: ${phoneNumber}`);

        if (message?.buttonsResponseMessage) {
          return await this.handleButtonResponse(messageData);
        }

        if (message?.pollUpdateMessage) {
          return await this.handlePollVote(messageData);
        }

        const textMessage =
          message?.conversation || message?.extendedTextMessage?.text;

        if (textMessage && /^[123]$/.test(textMessage.trim())) {
          return await this.handleNumericResponse(
            phoneNumber,
            textMessage.trim(),
          );
        }
      }

      return { status: 'ignored', reason: 'not_actionable' };
    } catch (error: any) {
      this.logger.error(`Erro ao processar mensagem: ${error.message}`);
      throw error;
    }
  }

  private async handleMessageUpdate(data: any) {
    try {
      const message = data?.message;

      if (message?.pollUpdateMessage) {
        return await this.handlePollVote(data);
      }

      return { status: 'ignored', reason: 'not_poll_update' };
    } catch (error: any) {
      this.logger.error(`Erro ao processar atualização: ${error.message}`);
      throw error;
    }
  }

  private async handleButtonResponse(data: any) {
    try {
      const buttonResponse = data?.message?.buttonsResponseMessage;
      const key = data?.key;

      const phoneNumber = key?.remoteJid?.replace('@s.whatsapp.net', '');
      const selectedButtonId = buttonResponse?.selectedButtonId;

      if (!selectedButtonId) {
        return { status: 'ignored', reason: 'no_button_selected' };
      }

      const parts = selectedButtonId.split('_');
      let action = selectedButtonId;

      if (parts.length > 1 && parts[parts.length - 1].length > 10) {
        action = parts.slice(0, -1).join('_');
      }

      this.logger.log(`Ação identificada (botão): ${action}`);
      return await this.processAction(phoneNumber, action);
    } catch (error: any) {
      this.logger.error(
        `Erro ao processar resposta de botão: ${error.message}`,
      );
      throw error;
    }
  }

  private async handlePollVote(data: any) {
    try {
      const pollUpdate = data?.message?.pollUpdateMessage;
      const key = data?.key;
      const phoneNumber = key?.remoteJid?.replace('@s.whatsapp.net', '');
      const votes = pollUpdate?.vote || [];

      if (!votes || votes.length === 0) {
        return { status: 'ignored', reason: 'no_votes' };
      }

      const selectedIndex = votes[0];

      const actionMap: Record<number, string> = {
        0: 'confirm_emergency',
        1: 'verify',
        2: 'false_alarm',
      };

      const action = actionMap[selectedIndex];

      if (!action) {
        return {
          status: 'error',
          reason: 'invalid_vote_index',
          index: selectedIndex,
        };
      }

      this.logger.log(
        `Ação identificada (poll): ${action} (índice ${selectedIndex})`,
      );
      return await this.processAction(phoneNumber, action);
    } catch (error: any) {
      this.logger.error(`Erro ao processar voto: ${error.message}`);
      throw error;
    }
  }

  private async handleNumericResponse(phoneNumber: string, number: string) {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');

      const contact = await this.prismaService.emergencyContact.findFirst({
        where: {
          phone: { contains: cleanPhone.slice(-9) },
        },
      });

      if (!contact) {
        return { status: 'error', reason: 'contact_not_found' };
      }

      const alert = await this.prismaService.fallAlert.findFirst({
        where: {
          patientId: contact.patientId,
          status: { in: ['PENDING', 'VERIFYING'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!alert) {
        return { status: 'error', reason: 'no_active_alert' };
      }

      let action: string | undefined;

      if (alert.status === 'VERIFYING') {
        const map: Record<string, string> = {
          '1': 'confirm_emergency',
          '2': 'false_alarm',
        };
        action = map[number];
      } else {
        const map: Record<string, string> = {
          '1': 'confirm_emergency',
          '2': 'verify',
          '3': 'false_alarm',
        };
        action = map[number];
      }

      if (!action) {
        return { status: 'error', reason: 'invalid_option', number };
      }

      this.logger.log(`Ação identificada (numérica): ${action}`);
      return await this.processAction(phoneNumber, action);
    } catch (error: any) {
      this.logger.error(
        `Erro ao processar resposta numérica: ${error.message}`,
      );
      throw error;
    }
  }

  private async processAction(phoneNumber: string, action: string) {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');

      const contact = await this.prismaService.emergencyContact.findFirst({
        where: {
          phone: { contains: cleanPhone.slice(-9) },
        },
        include: { patient: true },
      });

      if (!contact) {
        this.logger.warn(`Contato não encontrado para: ${phoneNumber}`);
        return { status: 'error', reason: 'contact_not_found' };
      }

      let caregiverId: string | null = null;

      const user = await this.prismaService.user.findFirst({
        where: {
          phone: { contains: cleanPhone.slice(-9) },
        },
      });

      if (user) {
        const relation = await this.prismaService.caregiverPatient.findUnique({
          where: {
            caregiverId_patientId: {
              caregiverId: user.id,
              patientId: contact.patientId,
            },
          },
        });

        const familyRelation =
          await this.prismaService.familyRelation.findFirst({
            where: {
              familyMemberId: user.id,
              patientId: contact.patientId,
            },
          });

        if (relation || familyRelation) {
          caregiverId = user.id;
          this.logger.log(
            `Usuário identificado respondendo: ${user.name} (ID: ${user.id})`,
          );
        }
      }

      const alert = await this.prismaService.fallAlert.findFirst({
        where: {
          patientId: contact.patientId,
          status: { in: ['PENDING', 'VERIFYING'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!alert) {
        this.logger.warn(
          `Nenhum alerta ativo para o paciente ${contact.patient.name}`,
        );
        return { status: 'error', reason: 'no_active_alert' };
      }

      let result;

      switch (action) {
        case 'confirm_emergency':
          if (alert.status === 'VERIFYING') {
            await this.fallAlertsService.confirmAfterVerification(
              alert.id,
              caregiverId,
              true,
            );
          } else {
            await this.fallAlertsService.confirmAlert(alert.id);
          }
          result = { action: 'emergency_confirmed', alertId: alert.id };
          break;

        case 'verify':
          await this.fallAlertsService.markVerifying(
            alert.id,
            caregiverId,
            true,
          );
          result = { action: 'marked_verifying', alertId: alert.id };
          break;

        case 'false_alarm':
          await this.fallAlertsService.markFalseAlarm(
            alert.id,
            caregiverId,
            true,
          );
          result = { action: 'false_alarm_confirmed', alertId: alert.id };
          break;

        case 'resolve_alert':
          await this.fallAlertsService.markResolved(alert.id);
          await this.messagingService.sendText(
            phoneNumber,
            `O alerta foi fechado como resolvido.`,
          );
          result = { action: 'alert_resolved', alertId: alert.id };
          break;

        default:
          return { status: 'error', reason: 'unknown_action', action };
      }

      return {
        status: 'success',
        ...result,
        patientName: contact.patient.name,
      };
    } catch (error: any) {
      this.logger.error(`Erro ao processar ação: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }
}
