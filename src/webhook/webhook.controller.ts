import {
  Controller,
  Post,
  Body,
  HttpException,
  Logger,
} from '@nestjs/common';
import { FallAlertsService } from '@src/fall-alerts/fall-alerts.service';
import { PrismaService } from '@src/prisma/prisma.service';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fallAlertsService: FallAlertsService,
  ) { }

  @Post('evolution')
  async handleEvolutionWebhook(@Body() body: any) {
    try {
      this.logger.log('📥 WEBHOOK RECEBIDO DA EVOLUTION API');
      this.logger.log(`📦 Event: ${body?.event || 'unknown'}`);

      if (!body || !body.event) return { ok: true };

      // Evento não é de mensagem → ignorar
      if (body.event !== 'messages.upsert') return { ok: true };

      const messages = body?.data?.messages;
      if (!messages?.length) return { ok: true };

      const msg = messages[0];

      const sender = msg.key?.remoteJid;
      const text =
        msg.message?.conversation ||
        msg.message?.extendedTextMessage?.text ||
        null;

      if (!sender || !text) return { ok: true };

      const phone = sender.replace('@s.whatsapp.net', '');

      const cleaned = text.trim().toLowerCase();

      this.logger.log(
        `📨 Mensagem de ${phone}: ${cleaned}`,
      );

      // Verificar se existe alerta PENDING / VERIFYING para este número
      const contact = await this.prisma.emergencyContact.findUnique({
        where: { phone },
      });

      if (!contact) {
        this.logger.warn(
          `⚠ Número ${phone} não é contato emergência.`,
        );
        return { ok: true };
      }

      const alert = await this.prisma.fallAlert.findFirst({
        where: {
          patientId: contact.patientId,
          status: { in: ['PENDING', 'VERIFYING'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!alert) {
        this.logger.warn(
          `⚠ Nenhum alerta pendente para o telefone ${phone}`,
        );
        return { ok: true };
      }

      const action = this.parseAction(cleaned);
      if (!action) {
        this.logger.log('⚠ Ação desconhecida, ignorando...');
        return { ok: true };
      }

      return await this.processAction(phone, alert, action);
    } catch (err) {
      this.logger.error('❌ Erro webhook:', err);
      throw new HttpException(
        'Erro interno no webhook',
        500,
      );
    }
  }

  /**
   * Interpretar ação pela mensagem
   */
  private parseAction(text: string) {
    if (['1', 'estou verificando', 'verificando'].includes(text))
      return 'verify';

    if (['2', 'falso alarme', 'falso', 'cancelar'].includes(text))
      return 'false_alarm';

    if (['3', 'confirmar', 'emergencia', 'confirmado'].includes(text))
      return 'confirm_emergency';

    return null;
  }

  /**
   * Processar ação do contato de emergência
   */
  private async processAction(phone: string, alert: any, action: string) {
    try {
      this.logger.log(
        `⚡ processAction → phone: ${phone} | action: ${action}`,
      );

      switch (action) {
        case 'verify':
          await this.fallAlertsService.markVerifying(
            alert.id,
            null,
            true, // fromWhatsApp
          );
          return {
            status: 'success',
            action: 'marked_verifying',
            alertId: alert.id,
          };

        case 'false_alarm':
          await this.fallAlertsService.markFalseAlarm(
            alert.id,
            null,
            true, // fromWhatsApp
          );
          return {
            status: 'success',
            action: 'false_alarm_marked',
            alertId: alert.id,
          };

        case 'confirm_emergency':
          if (alert.status === 'VERIFYING') {
            await this.fallAlertsService.confirmAfterVerification(
              alert.id,
              null,
              true, // fromWhatsApp
            );
          } else {
            await this.fallAlertsService.confirmAlert(alert.id);
          }

          return {
            status: 'success',
            action: 'emergency_confirmed',
            alertId: alert.id,
          };

        default:
          return { status: 'ignored' };
      }
    } catch (err) {
      this.logger.error('❌ Erro processAction:', err);

      throw new HttpException(
        err.message || 'Erro ao processar ação',
        500,
      );
    }
  }
}
