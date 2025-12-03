/* ============================================================
   WEBHOOK CONTROLLER — VERSÃO CORRIGIDA E FUNCIONAL
   ============================================================ */

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
  ) { }

  /* ============================================================
     RECEBE EVENTOS DA EVOLUTION API
     ============================================================ */

  @Post('evolution')
  async handleEvolutionWebhook(@Body() payload: any, @Headers() headers: any) {
    this.logger.log('📥 WEBHOOK RECEBIDO DA EVOLUTION API');
    this.logger.log(`📦 Event: ${payload.event}`);

    try {
      const { event, data } = payload;

      if (event === 'messages.upsert') {
        return await this.handleMessageReceived(data);
      }

      if (event === 'messages.update') {
        return await this.handleMessageUpdate(data);
      }

      return { status: 'ignored' };
    } catch (error: any) {
      this.logger.error('❌ Erro webhook:', error.message);
      return { status: 'error', message: error.message };
    }
  }

  /* ============================================================
     RECEBE MENSAGENS
     ============================================================ */

  private async handleMessageReceived(data: any) {
    try {
      const messages = Array.isArray(data) ? data : [data];

      for (const msg of messages) {
        const message = msg?.message;
        const key = msg?.key;

        if (!message || !key) continue;
        if (key.fromMe) continue;

        const phone = key.remoteJid.replace('@s.whatsapp.net', '');

        if (message.buttonsResponseMessage) {
          return this.handleButtonResponse(msg);
        }

        if (message.pollUpdateMessage) {
          return this.handlePollVote(msg);
        }

        const text =
          message?.conversation ||
          message?.extendedTextMessage?.text;

        if (text && /^[123]$/.test(text.trim())) {
          return this.handleNumericResponse(phone, text.trim());
        }
      }

      return { status: 'ignored' };
    } catch (err) {
      this.logger.error('❌ Erro handleMessageReceived:', err.message);
      throw err;
    }
  }

  /* ============================================================
     ATUALIZAÇÃO DE MENSAGEM (POLL)
     ============================================================ */

  private async handleMessageUpdate(data: any) {
    try {
      const message = data?.message;

      if (message?.pollUpdateMessage) {
        return await this.handlePollVote(data);
      }

      return { status: 'ignored' };
    } catch (err) {
      this.logger.error('❌ Erro handleMessageUpdate:', err.message);
      throw err;
    }
  }

  /* ============================================================
     RESPOSTA DE BOTÃO
     ============================================================ */

  private async handleButtonResponse(data: any) {
    try {
      const btn = data?.message?.buttonsResponseMessage;
      const phone = data?.key?.remoteJid.replace('@s.whatsapp.net', '');

      const btnId = btn?.selectedButtonId;
      if (!btnId) return { status: 'ignored' };

      const parts = btnId.split('_');
      const action = parts.slice(0, -1).join('_');

      return this.processAction(phone, action);
    } catch (err) {
      this.logger.error('❌ Erro handleButtonResponse:', err.message);
      throw err;
    }
  }

  /* ============================================================
     RESPOSTA DE POLL
     ============================================================ */

  private async handlePollVote(data: any) {
    try {
      const poll = data?.message?.pollUpdateMessage;
      const phone = data?.key?.remoteJid.replace('@s.whatsapp.net', '');

      const index = poll?.vote?.[0];

      const map = {
        0: 'confirm_emergency',
        1: 'verify',
        2: 'false_alarm',
      };

      const action = map[index];

      if (!action) return { status: 'ignored' };

      return this.processAction(phone, action);
    } catch (err) {
      this.logger.error('❌ Erro handlePollVote:', err.message);
      throw err;
    }
  }

  /* ============================================================
     RESPOSTA NUMÉRICA (1,2,3)
     ============================================================ */

  private async handleNumericResponse(phone: string, number: string) {
    try {
      const clean = phone.replace(/\D/g, '');

      const contact = await this.prismaService.emergencyContact.findFirst({
        where: { phone: { contains: clean.slice(-9) } },
      });

      if (!contact) return { status: 'error', reason: 'contact_not_found' };

      const alert = await this.prismaService.fallAlert.findFirst({
        where: {
          patientId: contact.patientId,
          status: { in: ['PENDING', 'VERIFYING'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!alert) return { status: 'error', reason: 'no_active_alert' };

      let action;

      if (alert.status === 'VERIFYING') {
        const map = { '1': 'confirm_emergency', '2': 'false_alarm' };
        action = map[number];
      } else {
        const map = { '1': 'confirm_emergency', '2': 'verify', '3': 'false_alarm' };
        action = map[number];
      }

      return this.processAction(phone, action);
    } catch (err) {
      this.logger.error('❌ Erro numericResponse:', err.message);
      throw err;
    }
  }

  /* ============================================================
     CÉREBRO DO SISTEMA — PROCESSA AÇÃO
     ============================================================ */

  private async processAction(phone: string, action: string) {
    try {
      const clean = phone.replace(/\D/g, '');

      /* =====================================================
         1) BUSCAR USER REAL E/OU CONTATO
         ===================================================== */

      const user = await this.prismaService.user.findFirst({
        where: { phone: { contains: clean.slice(-9) } },
      });

      const contact = await this.prismaService.emergencyContact.findFirst({
        where: { phone: { contains: clean.slice(-9) } },
        include: { patient: true },
      });

      if (!contact) {
        return { status: 'error', reason: 'phone_not_registered_anywhere' };
      }

      /* =====================================================
         2) DEFINIR IDENTIDADE DO RESPONSÁVEL
            (pode ser user.id OU contact.id)
         ===================================================== */

      let responderId: string;

      if (user) {
        responderId = user.id; // cuidador ou familiar do app
      } else {
        responderId = contact.id; // contato apenas do WhatsApp
      }

      /* =====================================================
         3) BUSCAR O ALERTA ATIVO
         ===================================================== */
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

      /* =====================================================
         4) BLOQUEIOS DE SEGURANÇA
         ===================================================== */

      if (['RESOLVED', 'CONFIRMED', 'FALSE_ALARM'].includes(alert.status)) {
        return { status: 'blocked', reason: 'alert_already_closed' };
      }

      if (alert.status === 'VERIFYING' && alert.respondedBy !== responderId) {
        return { status: 'blocked', reason: 'another_user_verifying' };
      }

      /* =====================================================
         5) EXECUTAR AÇÃO
         ===================================================== */

      if (action === 'verify') {
        await this.fallAlertsService.markVerifying(alert.id, responderId);
        return { status: 'success', action: 'verify', alertId: alert.id };
      }

      if (action === 'false_alarm') {
        await this.fallAlertsService.markFalseAlarm(alert.id, responderId);
        return { status: 'success', action: 'false_alarm', alertId: alert.id };
      }

      if (action === 'confirm_emergency') {
        if (alert.status === 'VERIFYING') {
          await this.fallAlertsService.confirmAfterVerification(alert.id, responderId);
        } else {
          await this.fallAlertsService.confirmAlert(alert.id);
        }

        return { status: 'success', action: 'confirm_emergency', alertId: alert.id };
      }

      return { status: 'ignored', reason: 'unknown_action' };
    } catch (err) {
      this.logger.error('❌ Erro processAction:', err.message);
      throw err;
    }
  }
}
