import { Controller, Post, Body, Logger, Headers } from '@nestjs/common';
import { FallAlertsService } from '../fall-alerts/fall-alerts.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly fallAlertsService: FallAlertsService,
    private readonly prismaService: PrismaService,
  ) {}

  /**
   * Webhook para receber eventos da Evolution API
   */
  @Post('evolution')
  async handleEvolutionWebhook(@Body() payload: any, @Headers() headers: any) {
    this.logger.log('📥 ================================');
    this.logger.log('📥 WEBHOOK RECEBIDO DA EVOLUTION API');
    this.logger.log('📥 ================================');
    this.logger.log(`📦 Event: ${payload.event}`);
    this.logger.log(`📊 Payload COMPLETO: ${JSON.stringify(payload, null, 2)}`);
    this.logger.log(`🔑 Data keys: ${Object.keys(payload.data || {}).join(', ')}`);

    try {
      const { event, data, instance } = payload;

      // Processar apenas eventos relevantes
      if (event === 'messages.upsert') {
        this.logger.log('🔵 Processando messages.upsert...');
        return await this.handleMessageReceived(data);
      }

      if (event === 'messages.update') {
        this.logger.log('🔵 Processando messages.update...');
        return await this.handleMessageUpdate(data);
      }

      this.logger.log(`ℹ️ Evento ignorado: ${event}`);
      return { status: 'ignored', event };

    } catch (error: any) {
      this.logger.error('❌ Erro ao processar webhook:', error.message);
      this.logger.error(error.stack);
      return { status: 'error', message: error.message };
    }
  }

  /**
   * Processar mensagem recebida (MESSAGES_UPSERT)
   */
  
  private async handleMessageReceived(data: any) {
    try {
      this.logger.log('📨 handleMessageReceived chamado');
      this.logger.log(`📦 Data recebido: ${JSON.stringify(data, null, 2)}`);

      // O data pode vir como objeto único ou array
      const messages = Array.isArray(data) ? data : [data];
      
      for (const messageData of messages) {
        const message = messageData?.message;
        const key = messageData?.key;

        if (!message || !key) {
          this.logger.warn('⚠️ Mensagem sem message ou key, pulando...');
          continue;
        }

        this.logger.log(`🔍 Checando message keys: ${Object.keys(message).join(', ')}`);

        // Ignorar mensagens enviadas por nós
        if (key?.fromMe) {
          this.logger.log('ℹ️ Mensagem enviada por nós, ignorando');
          continue;
        }

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
        const textMessage = message?.conversation || message?.extendedTextMessage?.text;
        
        if (textMessage) {
          this.logger.log(`💬 Mensagem de texto: "${textMessage}"`);
          
          // Verificar se é número (1, 2, 3)
          if (/^[123]$/.test(textMessage.trim())) {
            this.logger.log(`🔢 Resposta numérica detectada: ${textMessage}`);
            return await this.handleNumericResponse(phoneNumber, textMessage.trim());
          }
        }

        this.logger.log('ℹ️ Mensagem não é resposta de poll ou numérica');
      }

      return { status: 'ignored', reason: 'not_actionable' };

    } catch (error: any) {
      this.logger.error(`❌ Erro ao processar mensagem: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  /**
   * Processar atualização de mensagem (MESSAGES_UPDATE)
   */
  private async handleMessageUpdate(data: any) {
    try {
      this.logger.log('🔄 Atualização de mensagem recebida');
      
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
      const displayText = buttonResponse?.selectedDisplayText;

      this.logger.log(`\n🔘 ================================`);
      this.logger.log(`🔘 RESPOSTA DE BOTÃO RECEBIDA`);
      this.logger.log(`🔘 ================================`);
      this.logger.log(`📱 De: ${phoneNumber}`);
      this.logger.log(`🆔 Button ID: ${selectedButtonId}`);
      this.logger.log(`📝 Display Text: ${displayText}`);
      this.logger.log(`🔘 ================================\n`);

      if (!selectedButtonId) {
        this.logger.warn('⚠️ Nenhum botão selecionado');
        return { status: 'ignored', reason: 'no_button_selected' };
      }

      // O ID do botão tem formato: action_alertId
      // Ex: confirm_emergency_123, verify_456, false_alarm_789
      const parts = selectedButtonId.split('_');
      
      // Se tiver alertId no final, extrair
      let action = selectedButtonId;
      if (parts.length > 1) {
        // Pegar tudo menos o último elemento (que seria o alertId)
        action = parts.slice(0, -1).join('_');
      }

      this.logger.log(`✅ Ação identificada: ${action}`);

      return await this.processAction(phoneNumber, action);

    } catch (error: any) {
      this.logger.error(`❌ Erro ao processar resposta de botão: ${error.message}`);
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

      this.logger.log(`\n🗳️ ================================`);
      this.logger.log(`🗳️ VOTO EM POLL RECEBIDO`);
      this.logger.log(`🗳️ ================================`);
      this.logger.log(`📱 De: ${phoneNumber}`);
      this.logger.log(`📊 Votos: ${JSON.stringify(votes)}`);
      this.logger.log(`🗳️ ================================\n`);

      if (!votes || votes.length === 0) {
        this.logger.warn('⚠️ Nenhum voto encontrado no poll');
        return { status: 'ignored', reason: 'no_votes' };
      }

      // O voto vem como array de índices (0, 1, 2)
      const selectedIndex = votes[0];
      
      // Mapear índice para ação
      const actionMap = {
        0: 'confirm_emergency',  // Opção 1: Confirmar Emergência
        1: 'verify',              // Opção 2: Estou Verificando
        2: 'false_alarm',         // Opção 3: Falso Alarme
      };

      const action = actionMap[selectedIndex];

      if (!action) {
        this.logger.warn(`⚠️ Índice de voto inválido: ${selectedIndex}`);
        return { status: 'error', reason: 'invalid_vote_index', index: selectedIndex };
      }

      this.logger.log(`✅ Ação identificada: ${action} (índice ${selectedIndex})`);

      return await this.processAction(phoneNumber, action);

    } catch (error: any) {
      this.logger.error(`❌ Erro ao processar voto: ${error.message}`);
      throw error;
    }
  }

  /**
   * Processar resposta numérica (1, 2, 3)
   * Suporta dois formatos:
   * - Alerta inicial: 1=confirmar, 2=verificar, 3=falso alarme
   * - Lembrete verificação: 1=emergência, 2=tudo bem
   */
  private async handleNumericResponse(phoneNumber: string, number: string) {
    try {
      this.logger.log(`\n🔢 ================================`);
      this.logger.log(`🔢 RESPOSTA NUMÉRICA DETECTADA`);
      this.logger.log(`🔢 ================================`);
      this.logger.log(`📱 De: ${phoneNumber}`);
      this.logger.log(`🔢 Número: ${number}`);

      // Buscar contato para determinar o alerta
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const contact = await this.prismaService.emergencyContact.findFirst({
        where: {
          phone: {
            contains: cleanPhone.slice(-9),
          },
        },
      });

      if (!contact) {
        this.logger.warn(`⚠️ Contato não encontrado`);
        return { status: 'error', reason: 'contact_not_found' };
      }

      // Buscar último alerta do paciente
      const alert = await this.prismaService.fallAlert.findFirst({
        where: {
          patientId: contact.patientId,
          status: {
            in: ['PENDING', 'VERIFYING'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!alert) {
        this.logger.warn(`⚠️ Nenhum alerta ativo encontrado`);
        return { status: 'error', reason: 'no_active_alert' };
      }

      // Determinar ação baseada no status do alerta
      let action: string;

      if (alert.status === 'VERIFYING') {
        // Lembrete de verificação: 1=emergência, 2=tudo bem
        const verificationActionMap = {
          '1': 'confirm_emergency',  // 🚨 É Emergência!
          '2': 'false_alarm',         // ✅ Está Tudo Bem
        };
        action = verificationActionMap[number];
        this.logger.log(`� Alerta em VERIFYING - Mapeamento lembrete`);
      } else {
        // Alerta inicial: 1=confirmar, 2=verificar, 3=falso alarme
        const initialActionMap = {
          '1': 'confirm_emergency',  // ✅ Confirmar Emergência
          '2': 'verify',              // 🔍 Estou Verificando
          '3': 'false_alarm',         // ❌ Falso Alarme
        };
        action = initialActionMap[number];
        this.logger.log(`🆕 Alerta PENDING - Mapeamento inicial`);
      }

      if (!action) {
        this.logger.warn(`⚠️ Número inválido: ${number} para status ${alert.status}`);
        return { status: 'error', reason: 'invalid_option', number };
      }

      this.logger.log(`✅ Ação: ${action}`);
      this.logger.log(`🔢 ================================\n`);

      return await this.processAction(phoneNumber, action);

    } catch (error: any) {
      this.logger.error(`❌ Erro ao processar resposta numérica: ${error.message}`);
      throw error;
    }
  }

  /**
   * Processar ação baseada na resposta (poll ou numérica)
   */
  private async processAction(phoneNumber: string, action: string) {
    try {
      this.logger.log(`\n🎯 ================================`);
      this.logger.log(`🎯 PROCESSANDO AÇÃO`);
      this.logger.log(`🎯 ================================`);
      this.logger.log(`📱 Telefone: ${phoneNumber}`);
      this.logger.log(`🎬 Ação: ${action}`);

      // 1. Buscar contato pelo telefone
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const contact = await this.prismaService.emergencyContact.findFirst({
        where: {
          phone: {
            contains: cleanPhone.slice(-9), // Últimos 9 dígitos
          },
        },
        include: {
          patient: true,
        },
      });

      if (!contact) {
        this.logger.warn(`⚠️ Contato não encontrado para: ${phoneNumber}`);
        return { status: 'error', reason: 'contact_not_found', phone: phoneNumber };
      }

      this.logger.log(`👤 Contato encontrado: ${contact.name} (ID: ${contact.id})`);
      this.logger.log(`👨‍⚕️ Paciente: ${contact.patient.name}`);
      
      // Buscar cuidador principal deste paciente
      const caregiverRelation = await this.prismaService.caregiverPatient.findFirst({
        where: {
          patientId: contact.patientId,
        },
        include: {
          caregiver: true,
        },
      });
      
      if (!caregiverRelation) {
        this.logger.warn(`⚠️ Nenhum cuidador associado ao paciente ${contact.patient.name}`);
        return { status: 'error', reason: 'no_caregiver_found', patientId: contact.patientId };
      }
      
      const caregiverId = caregiverRelation.caregiverId;
      this.logger.log(`👤 Caregiver ID: ${caregiverId} (${caregiverRelation.caregiver.name})`);

      // 2. Buscar último alerta PENDING ou VERIFYING do paciente
      const alert = await this.prismaService.fallAlert.findFirst({
        where: {
          patientId: contact.patientId,
          status: {
            in: ['PENDING', 'VERIFYING'],
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      });

      if (!alert) {
        this.logger.warn(`⚠️ Nenhum alerta ativo encontrado para o paciente ${contact.patient.name}`);
        return { status: 'error', reason: 'no_active_alert', patientId: contact.patientId };
      }

      this.logger.log(`🚨 Alerta encontrado: ${alert.id} (Status: ${alert.status})`);

      // 3. Executar ação
      let result;
      switch (action) {
        case 'confirm_emergency':
          this.logger.log(`🚨 Confirmando emergência para alerta ${alert.id}...`);
          
          // Se o alerta está em VERIFYING, usar confirmAfterVerification
          if (alert.status === 'VERIFYING') {
            this.logger.log(`🔍 Alerta está em VERIFYING - usando confirmAfterVerification`);
            await this.fallAlertsService.confirmAfterVerification(alert.id, caregiverId);
          } else {
            await this.fallAlertsService.confirmAlert(alert.id);
          }
          
          result = { action: 'emergency_confirmed', alertId: alert.id };
          this.logger.log(`✅ Emergência confirmada!`);
          break;

        case 'verify':
          this.logger.log(`🔍 Marcando alerta ${alert.id} como verificando...`);
          await this.fallAlertsService.markVerifying(alert.id, caregiverId);
          result = { action: 'marked_verifying', alertId: alert.id };
          this.logger.log(`✅ Alerta marcado como verificando!`);
          break;

        case 'false_alarm':
          this.logger.log(`❌ Marcando alerta ${alert.id} como falso alarme...`);
          await this.fallAlertsService.markFalseAlarm(alert.id, caregiverId);
          result = { action: 'false_alarm_confirmed', alertId: alert.id };
          this.logger.log(`✅ Falso alarme confirmado!`);
          break;

        default:
          this.logger.warn(`⚠️ Ação desconhecida: ${action}`);
          return { status: 'error', reason: 'unknown_action', action };
      }

      this.logger.log(`🎯 ================================\n`);

      return {
        status: 'success',
        ...result,
        contactName: contact.name,
        patientName: contact.patient.name,
      };

    } catch (error: any) {
      this.logger.error(`❌ Erro ao processar ação: ${error.message}`);
      this.logger.error(error.stack);
      throw error;
    }
  }

  /**
   * Endpoint de teste (útil para desenvolvimento)
   */

  @Post('test-action')
  async testAction(@Body() body: { phoneNumber: string; action: string }) {
    this.logger.log(`🧪 ================================`);
    this.logger.log(`🧪 TESTE MANUAL`);
    this.logger.log(`🧪 Phone: ${body.phoneNumber}`);
    this.logger.log(`🧪 Action: ${body.action}`);
    this.logger.log(`🧪 ================================`);
    
    return await this.processAction(body.phoneNumber, body.action);
  }
}
