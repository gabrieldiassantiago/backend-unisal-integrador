import { Injectable } from '@nestjs/common';
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

@Injectable()

export class TwilioService {
  public client: Twilio;

  constructor(private readonly configService: ConfigService) {
    this.client = new Twilio(
      this.configService.get<string>('TWILIO_ACCOUNT_SID'),
      this.configService.get<string>('TWILIO_AUTH_TOKEN'),
    );
  }

  async makeFallAlertCall(to: string, patientName: string) {
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
  }

  async sendWhatsAppMessage(to: string, message: string) {
    console.log('[TwilioService] Enviando WhatsApp para:', to);
    console.log('[TwilioService] Mensagem:', message);

    try {
      const cleanNumber = to.replace(/\D/g, '');
      const whatsappNumber = `whatsapp:+${cleanNumber}`;
      
      const messageResponse = await this.client.messages.create({
        from: this.configService.get<string>('TWILIO_WHATSAPP_NUMBER'),
        to: whatsappNumber,
        body: message
      });

      console.log('[TwilioService] WhatsApp enviado com sucesso. SID:', messageResponse.sid);
      return messageResponse;
    } catch (error: any) {
      console.error('[TwilioService] Erro ao enviar WhatsApp:', error);
      throw error;
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
