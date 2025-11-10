import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { AxiosInstance } from 'axios';
import {
  infobipFallAlertText,
  infobipFallAlertTemplateData,
  InfobipFallAlertParams,
  infobipFalseAlarmText,
  infobipFalseAlarmTemplateData,
  InfobipFalseAlarmParams,
  infobipEmergencyText,
  infobipEmergencyTemplateData,
  InfobipEmergencyParams,
  infobipVerificationReminderText,
  infobipVerificationReminderTemplateData,
  InfobipVerificationReminderParams,
  infobipAlertResolvedText,
  InfobipAlertResolvedParams,
} from './templates';

export interface InfobipTemplateParams {
  patientName: string;
  location?: string;
  caregiverName?: string;
  alertType?: string;
}

interface InfobipTextMessage {
  from: string;
  to: string;
  messageId?: string;
  content: {
    text: string;
  };
}

interface InfobipTemplateMessage {
  from: string;
  to: string;
  messageId?: string;
  content: {
    templateName: string;
    templateData: {
      body: {
        placeholders: string[];
      };
    };
    language: string;
  };
}

@Injectable()
export class InfobipService {
  private readonly logger = new Logger(InfobipService.name);
  private httpClient: AxiosInstance;
  private readonly sender: string;
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('INFOBIP_API_KEY');
    this.baseUrl = this.configService.get<string>('INFOBIP_BASE_URL');
    this.sender = this.configService.get<string>('INFOBIP_WHATSAPP_SENDER');

    // 🔍 Validar configurações
    if (!this.apiKey) {
      this.logger.error('❌ INFOBIP_API_KEY não configurada no .env!');
    } else {
      this.logger.log(`✅ API Key configurada (primeiros 10 chars): ${this.apiKey.substring(0, 10)}...`);
    }
    
    if (!this.baseUrl) {
      this.logger.error('❌ INFOBIP_BASE_URL não configurada no .env!');
    } else {
      this.logger.log(`✅ Base URL: ${this.baseUrl}`);
    }
    
    if (!this.sender) {
      this.logger.error('❌ INFOBIP_WHATSAPP_SENDER não configurado no .env!');
    } else {
      this.logger.log(`✅ Sender: ${this.sender}`);
    }

    // Criar cliente HTTP com configurações
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `App ${this.apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    this.logger.log('✅ Infobip WhatsApp Service inicializado');
  }

  /**
   * Enviar mensagem de texto simples (dentro da janela de 24h)
   */
  async sendTextMessage(to: string, text: string): Promise<any> {
    try {
      // Limpar número (remover caracteres especiais)
      const cleanNumber = to.replace(/\D/g, '');

      this.logger.log(`📤 Enviando mensagem de texto para ${cleanNumber}`);

      const message: InfobipTextMessage = {
        from: this.sender,
        to: cleanNumber,
        content: {
          text: text,
        },
      };

      const response = await this.httpClient.post('/whatsapp/1/message/text', {
        messages: [message],
      });

      this.logger.log(`✅ Mensagem enviada via Infobip! Status: ${response.data.messages?.[0]?.status?.groupName}`);
      
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Erro ao enviar mensagem via Infobip: ${error.response?.data?.requestError?.serviceException?.text || error.message}`);
      this.logger.error(`Status Code: ${error.response?.status}`);
      this.logger.error(`Response: ${JSON.stringify(error.response?.data)}`);
      throw error;
    }
  }

  /**
   * Enviar template de alerta de queda (para iniciar conversação)
   */
  async sendFallAlertTemplate(to: string, params: InfobipTemplateParams): Promise<any> {
    try {
      const cleanNumber = to.replace(/\D/g, '');

      this.logger.log(`📤 Enviando template de alerta de queda para ${cleanNumber}`);
      this.logger.log(`📋 Parâmetros: ${JSON.stringify(params)}`);

      const message: InfobipTemplateMessage = {
        from: this.sender,
        to: cleanNumber,
        messageId: `fall-alert-${Date.now()}`,
        content: {
          templateName: 'test_whatsapp_template_en', // Substitua pelo nome do seu template aprovado
          templateData: {
            body: {
              placeholders: [params.patientName],
            },
          },
          language: 'en',
        },
      };

      const response = await this.httpClient.post('/whatsapp/1/message/template', {
        messages: [message],
      });

      this.logger.log(`✅ Template enviado via Infobip! Message ID: ${response.data.messages?.[0]?.messageId}`);
      
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Erro ao enviar template via Infobip: ${error.response?.data || error.message}`);
      throw error;
    }
  }

  /**
   * Enviar alerta de queda usando templates
   */
  async sendFallAlert(to: string, params: InfobipFallAlertParams): Promise<any> {
    try {
      const cleanNumber = to.replace(/\D/g, '');

      this.logger.log(`📤 Enviando alerta de queda para ${cleanNumber}`);

      // 🆕 USAR TEMPLATE DE TESTE PRÉ-APROVADO (modo trial)
      // No modo trial, use o template test_whatsapp_template_en que já vem aprovado
      const message: InfobipTemplateMessage = {
        from: this.sender,
        to: cleanNumber,
        messageId: `fall-alert-${Date.now()}`,
        content: {
          templateName: 'test_whatsapp_template_en', // Template de teste pré-aprovado
          templateData: {
            body: {
              placeholders: [params.patientName], // Apenas 1 placeholder
            },
          },
          language: 'en',
        },
      };

      this.logger.log(`📦 Payload completo: ${JSON.stringify({ messages: [message] }, null, 2)}`);

      const response = await this.httpClient.post('/whatsapp/1/message/template', {
        messages: [message],
      });

      this.logger.log(`✅ Alerta de queda enviado via template! Message ID: ${response.data.messages?.[0]?.messageId}`);
      this.logger.log(`📊 Status: ${response.data.messages?.[0]?.status?.groupName}`);
      
      return response.data;
    } catch (error: any) {
      this.logger.warn(`⚠️ Erro ao enviar template: ${error.response?.data?.requestError?.serviceException?.text || error.message}`);
      this.logger.error(`❌ Status Code: ${error.response?.status}`);
      this.logger.error(`❌ Response completo: ${JSON.stringify(error.response?.data, null, 2)}`);
      this.logger.warn(`⚠️ Tentando mensagem de texto livre (só funciona se houver janela ativa de 24h)...`);
      
      // Se falhar (limite de templates ou erro), tentar mensagem de texto livre
      // Isso só funciona se já houver uma conversação ativa (janela de 24h)
      const textMessage = infobipFallAlertText(params);
      return await this.sendTextMessage(to, textMessage);
    }
  }

  /**
   * Enviar confirmação de falso alarme
   */
  async sendFalseAlarmNotification(to: string, params: InfobipFalseAlarmParams): Promise<any> {
    try {
      const message = infobipFalseAlarmText(params);
      return await this.sendTextMessage(to, message);
    } catch (error: any) {
      this.logger.error(`❌ Erro ao enviar notificação de falso alarme: ${error.response?.data || error.message}`);
      throw error;
    }
  }

  /**
   * Enviar notificação de emergência confirmada
   */
  async sendEmergencyConfirmed(to: string, params: InfobipEmergencyParams): Promise<any> {
    try {
      const message = infobipEmergencyText(params);
      return await this.sendTextMessage(to, message);
    } catch (error: any) {
      this.logger.error(`❌ Erro ao enviar confirmação de emergência: ${error.response?.data || error.message}`);
      throw error;
    }
  }

  /**
   * Enviar lembrete de verificação
   */
  async sendVerificationReminder(to: string, params: InfobipVerificationReminderParams): Promise<any> {
    try {
      const message = infobipVerificationReminderText(params);
      return await this.sendTextMessage(to, message);
    } catch (error: any) {
      this.logger.error(`❌ Erro ao enviar lembrete: ${error.response?.data || error.message}`);
      throw error;
    }
  }

  /**
   * Enviar alerta resolvido
   */
  async sendAlertResolved(to: string, params: InfobipAlertResolvedParams): Promise<any> {
    try {
      const message = infobipAlertResolvedText(params);
      return await this.sendTextMessage(to, message);
    } catch (error: any) {
      this.logger.error(`❌ Erro ao enviar alerta resolvido: ${error.response?.data || error.message}`);
      throw error;
    }
  }

  /**
   * Verificar status de mensagem enviada
   */
  async getMessageStatus(messageId: string): Promise<any> {
    try {
      // A API Infobip permite consultar o status via webhooks ou logs
      // Aqui você pode implementar a lógica de webhook se necessário
      this.logger.log(`🔍 Consultando status da mensagem ${messageId}`);
      
      // Por enquanto, apenas log
      return { messageId, note: 'Check Infobip logs for delivery status' };
    } catch (error: any) {
      this.logger.error(`❌ Erro ao consultar status: ${error.message}`);
      throw error;
    }
  }
}
