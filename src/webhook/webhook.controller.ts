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

  /**
   * Webhook para receber eventos da Evolution API
   */
  @Post('evolution')
  async handleEvolutionWebhook(@Body() payload: any, @Headers() headers: any) {
    // Logs reduzidos para limpeza, mantenha verbose se necessário
    // this.logger.log('📥 WEBHOOK RECEBIDO DA EVOLUTION API');

    try {
      const { event, data } = payload;

      // Processar apenas eventos relevantes
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

  /**
   * Processar mensagem recebida (MESSAGES_UPSERT)
   */
  private async handleMessageReceived(data: any) {
    try {
      // O data pode vir como objeto único ou array
      const messages = Array.isArray(data) ? data : [data];

      for (const messageData of messages) {
        const message = messageData?.message;
        const key = messageData?.key;

        if (!message || !key) continue;

        // Ignorar mensagens enviadas por nós
        if (key?.fromMe) continue;

        const remoteJid = key?.remoteJid;
        const phoneNumber = remoteJid?.replace('@s.whatsapp.net', '');

        this.logger.log(`📱 Mensagem recebida de: ${phoneNumber}`);

        // 1. Verificar se é resposta de BOTÃO
        if (message?.buttonsResponseMessage) {
          this.logger.log('🔘 Resposta de BOTÃO detectada!');
          return await this.handleButtonResponse(messageData);
        }

        // 2. Verificar se é resposta de POLL (enquete)
        if (message?.pollUpdateMessage) {
          this.logger.log('🗳️ Resposta de POLL detectada!');
          return await this.handlePollVote(messageData);
        }

        // 3. Verificar se é mensagem de texto simples (resposta numérica)
        const textMessage =
          message?.conversation || message?.extendedTextMessage?.text;

        if (textMessage) {
          // Verificar se é número (1, 2, 3)
          if (/^[123]$/.test(textMessage.trim())) {
            this.logger.log(`🔢 Resposta numérica detectada: ${textMessage}`);
            return await this.handleNumericResponse(
              phoneNumber,
              textMessage.trim(),
            );
          }
        }
      }

      return { status: 'ignored', reason: 'not_actionable' };
    } catch (error: any) {
      this.logger.error(`❌ Erro ao processar mensagem: ${error.message}`);
      throw error;
    }
  }

  /**
   * Processar atualização de mensagem (MESSAGES_UPDATE)
   */
  private async handleMessageUpdate(data: any) {
    try {
      const message = data?.message;

      if (message?.pollUpdateMessage) {
        this.logger.log('🗳️ Atualização de POLL detectada!');
        return await this.handlePollVote(data);
      }

      return { status: 'ignored', reason: 'not_poll_update' };
    } catch (error: any) {
      this.logger.error(`❌ Erro ao processar atualização: ${error.message}`);
      throw error;
    }
  }

  /**
   * Processar resposta de BOTÃO
   */
  private async handleButtonResponse(data: any) {
    try {
      const buttonResponse = data?.message?.buttonsResponseMessage;
      const key = data?.key;

      const phoneNumber = key?.remoteJid?.replace('@s.whatsapp.net', '');
      const selectedButtonId = buttonResponse?.selectedButtonId;

      if (!selectedButtonId) {
        return { status: 'ignored', reason: 'no_button_selected' };
      }

      // O ID do botão tem formato: action_alertId (ex: confirm_123)
      // Extrair apenas a ação base, ignorando o ID do alerta se houver sufixo
      // Assumindo formatos simples como 'confirm_emergency', 'verify', etc.
      // Se houver ID no botão, o processAction vai buscar o alerta ATIVO no banco de qualquer forma.

      const parts = selectedButtonId.split('_');
      // Lógica simplificada: Se o último item for numérico ou UUID, removemos. 
      // Mas suas ações são strings fixas no service geralmente, então vamos pegar a action pura.

      // Ajuste para o seu padrão: se o botão for 'confirm_emergency_uuid', pegamos 'confirm_emergency'
      // Se for apenas 'confirm_emergency', pegamos ele todo.

      let action = selectedButtonId;
      // Regex básica para ver se termina com UUID ou ID numérico grande
      if (parts.length > 1 && parts[parts.length - 1].length > 10) {
        action = parts.slice(0, -1).join('_');
      }

      this.logger.log(`✅ Ação identificada (botão): ${action}`);
      return await this.processAction(phoneNumber, action);
    } catch (error: any) {
      this.logger.error(
        `❌ Erro ao processar resposta de botão: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Processar voto em POLL (enquete)
   */
  private async handlePollVote(data: any) {
    try {
      const pollUpdate = data?.message?.pollUpdateMessage;
      const key = data?.key;
      const phoneNumber = key?.remoteJid?.replace('@s.whatsapp.net', '');
      const votes = pollUpdate?.vote || [];

      if (!votes || votes.length === 0) {
        return { status: 'ignored', reason: 'no_votes' };
      }

      const selectedIndex = votes[0]; // Pega o primeiro voto

      const actionMap: Record<number, string> = {
        0: 'confirm_emergency', // Opção 1
        1: 'verify',            // Opção 2
        2: 'false_alarm',       // Opção 3
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
        `✅ Ação identificada (poll): ${action} (índice ${selectedIndex})`,
      );
      return await this.processAction(phoneNumber, action);
    } catch (error: any) {
      this.logger.error(`❌ Erro ao processar voto: ${error.message}`);
      throw error;
    }
  }

  /**
   * Processar resposta numérica (1, 2, 3)
   */
  private async handleNumericResponse(phoneNumber: string, number: string) {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');

      // Buscar contato para determinar o alerta e o status atual
      const contact = await this.prismaService.emergencyContact.findFirst({
        where: {
          phone: { contains: cleanPhone.slice(-9) },
        },
      });

      if (!contact) {
        return { status: 'error', reason: 'contact_not_found' };
      }

      // Buscar alerta ativo
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
        // Lembrete: 1=Emergência, 2=Tudo bem
        const map: Record<string, string> = {
          '1': 'confirm_emergency',
          '2': 'false_alarm',
        };
        action = map[number];
      } else {
        // Inicial: 1=Confirmar, 2=Verificar, 3=Falso Alarme
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

      this.logger.log(`✅ Ação identificada (numérica): ${action}`);
      return await this.processAction(phoneNumber, action);
    } catch (error: any) {
      this.logger.error(
        `❌ Erro ao processar resposta numérica: ${error.message}`,
      );
      throw error;
    }
  }

  /**
   * Processar ação baseada na resposta
   * ADAPTADO PARA O SERVICE FORNECIDO
   */
  private async processAction(phoneNumber: string, action: string) {
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');

      // 1. Buscar contato e Paciente
      const contact = await this.prismaService.emergencyContact.findFirst({
        where: {
          phone: { contains: cleanPhone.slice(-9) },
        },
        include: { patient: true },
      });

      if (!contact) {
        this.logger.warn(`⚠️ Contato não encontrado para: ${phoneNumber}`);
        return { status: 'error', reason: 'contact_not_found' };
      }

      // 2. Tentar identificar se esse número pertence a um Cuidador (User)
      // Isso é importante para preencher o campo 'respondedBy' no Service
      let caregiverId: string | null = null;

      // Busca se existe um usuário com esse telefone
      const user = await this.prismaService.user.findFirst({
        where: {
          phone: { contains: cleanPhone.slice(-9) }
        }
      });

      // Se achou usuário, verifica se ele tem relação com o paciente
      if (user) {
        const relation = await this.prismaService.caregiverPatient.findUnique({
          where: {
            caregiverId_patientId: {
              caregiverId: user.id,
              patientId: contact.patientId
            }
          }
        });
        // Também pode ser familiar
        const familyRelation = await this.prismaService.familyRelation.findFirst({
          where: {
            familyMemberId: user.id,
            patientId: contact.patientId
          }
        });

        if (relation || familyRelation) {
          caregiverId = user.id;
          this.logger.log(`👤 Usuário identificado respondendo: ${user.name} (ID: ${user.id})`);
        }
      }

      // 3. Buscar alerta ATIVO (PENDING ou VERIFYING)
      const alert = await this.prismaService.fallAlert.findFirst({
        where: {
          patientId: contact.patientId,
          status: { in: ['PENDING', 'VERIFYING'] },
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!alert) {
        this.logger.warn(
          `⚠️ Nenhum alerta ativo para o paciente ${contact.patient.name}`,
        );
        return { status: 'error', reason: 'no_active_alert' };
      }

      // 4. Executar ação no Service
      // OBS: Passamos fromWhatsApp = true (terceiro argumento) para pular checagens estritas de ID

      let result;
      switch (action) {
        case 'confirm_emergency':
          this.logger.log(`🚨 Confirmando emergência (WhatsApp)...`);

          if (alert.status === 'VERIFYING') {
            // Se já estava verificando, usamos confirmAfterVerification
            await this.fallAlertsService.confirmAfterVerification(
              alert.id,
              caregiverId,
              true // fromWhatsApp
            );
          } else {
            // Se estava pendente, confirmação direta
            await this.fallAlertsService.confirmAlert(alert.id);
          }
          result = { action: 'emergency_confirmed', alertId: alert.id };
          break;

        case 'verify':
          this.logger.log(`🔍 Marcando como verificando (WhatsApp)...`);
          await this.fallAlertsService.markVerifying(
            alert.id,
            caregiverId,
            true // fromWhatsApp
          );
          result = { action: 'marked_verifying', alertId: alert.id };
          break;

        case 'false_alarm':
          this.logger.log(`❌ Marcando como falso alarme (WhatsApp)...`);
          await this.fallAlertsService.markFalseAlarm(
            alert.id,
            caregiverId,
            true // fromWhatsApp
          );
          result = { action: 'false_alarm_confirmed', alertId: alert.id };
          break;

        case 'resolve_alert':
          this.logger.log(`🏁 Finalizando alerta (WhatsApp)...`);
          await this.fallAlertsService.markResolved(alert.id);

          // Feedback manual via texto, já que markResolved no service notifica via Push
          await this.messagingService.sendText(
            phoneNumber,
            `✅ *Obrigado!* \n\nO alerta foi fechado como resolvido.`
          );
          result = { action: 'alert_resolved', alertId: alert.id };
          break;

        default:
          this.logger.warn(`⚠️ Ação desconhecida: ${action}`);
          return { status: 'error', reason: 'unknown_action', action };
      }

      return {
        status: 'success',
        ...result,
        patientName: contact.patient.name,
      };

    } catch (error: any) {
      this.logger.error(`❌ Erro ao processar ação: ${error.message}`);
      // Não damos throw aqui para não quebrar o webhook, retornamos erro controlado
      return { status: 'error', message: error.message };
    }
  }
}