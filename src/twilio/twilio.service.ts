import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';
import {
  fallAlertTemplate,
  fallAlertCallTwiml,
  emergencyConfirmedTemplate,
  falseAlarmTemplate,
  alertResolvedTemplate,
  callAnsweredTemplate,
  FallAlertTemplateParams,
  EmergencyTemplateParams,
  FalseAlarmTemplateParams,
  AlertResolvedTemplateParams,
  CallAnsweredTemplateParams
} from './templates';
import { MessagingService } from '../messaging/messaging.service';

@Injectable()
export class TwilioService {
  private readonly logger = new Logger(TwilioService.name);
  public client: Twilio;

  constructor(
    private readonly configService: ConfigService,
    private readonly messagingService: MessagingService, // 🆕 Usar MessagingService
  ) {
    this.client = new Twilio(
      this.configService.get<string>('TWILIO_ACCOUNT_SID'),
      this.configService.get<string>('TWILIO_AUTH_TOKEN'),
    );
  }

  async makeFallAlertCall(to: string, patientName: string) {
    this.logger.log('[TwilioService] 📞 Chamadas Twilio desativadas temporariamente');
    this.logger.log('[TwilioService] Enviando apenas WhatsApp via Infobip para:', to);
    
    // Retornar objeto simulado para não quebrar o fluxo
    return {
      sid: 'TWILIO_DISABLED',
      status: 'disabled',
      message: 'Twilio calls are currently disabled, using Infobip WhatsApp only'
    };
    
    /* TWILIO CALLS DESATIVADAS TEMPORARIAMENTE
    console.log('[TwilioService] Fazendo chamada para:', to);
    console.log('[TwilioService] Paciente:', patientName);

    try {
      const call = await this.client.calls.create({
        from: this.configService.get<string>('TWILIO_PHONE_NUMBER'),
        to,
        twiml: fallAlertCallTwiml(patientName)
      });

      return call;
    } catch (error: any) {
      throw error;
    }
    */
  }

  async sendWhatsAppMessage(to: string, message: string) {
    this.logger.log('[TwilioService] � Enviando via API de Mensagens');
    this.logger.log(`[TwilioService] Para: ${to}`);
    
    // 🆕 USAR API DE MENSAGENS DIRETAMENTE
    try {
      const response = await this.messagingService.sendText(to, message);
      this.logger.log('[TwilioService] ✅ Mensagem enviada com sucesso');
      return response;
    } catch (error: any) {
      this.logger.error('[TwilioService] ❌ Erro ao enviar mensagem:', error.message);
      throw new Error(`Falha ao enviar mensagem: ${error.message}`);
    }
  }

  async sendWhatsAppTemplate(to: string, templateSid: string, variables: { [key: string]: string }) {
    console.log('[TwilioService] Enviando template WhatsApp para:', to);
    console.log('[TwilioService] Template SID:', templateSid);
    console.log('[TwilioService] Variáveis:', variables);

    try {
      const cleanNumber = to.replace(/\D/g, '');
      const whatsappNumber = `whatsapp:+${cleanNumber}`;
      
      const messageResponse = await this.client.messages.create({
        from: `whatsapp:${this.configService.get<string>('TWILIO_WHATSAPP_NUMBER')}`,
        to: whatsappNumber,
        contentSid: templateSid,
        contentVariables: JSON.stringify(variables)
      });

      console.log('[TwilioService] Template WhatsApp enviado com sucesso. SID:', messageResponse.sid);
      return messageResponse;
    } catch (error: any) {
      console.error('[TwilioService] Erro ao enviar template WhatsApp:', error);
      throw error;
    }
  }

  //  Métodos específicos usando os templates
  async sendFallAlertWhatsApp(to: string, params: FallAlertTemplateParams) {
    const message = fallAlertTemplate(params);
    return this.sendWhatsAppMessage(to, message);
  }

  async sendEmergencyConfirmedWhatsApp(to: string, params: EmergencyTemplateParams) {
    const message = emergencyConfirmedTemplate(params);
    return this.sendWhatsAppMessage(to, message);
  }

  async sendFalseAlarmWhatsApp(to: string, params: FalseAlarmTemplateParams) {
    const message = falseAlarmTemplate(params);
    return this.sendWhatsAppMessage(to, message);
  }

  async sendAlertResolvedWhatsApp(to: string, params: AlertResolvedTemplateParams) {
    const message = alertResolvedTemplate(params);
    return this.sendWhatsAppMessage(to, message);
  }

  async sendCallAnsweredConfirmationWhatsApp(to: string, params: CallAnsweredTemplateParams) {
    const message = callAnsweredTemplate(params);
    return this.sendWhatsAppMessage(to, message);
  }
}
