import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Twilio } from 'twilio';

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
    console.log('[TwilioService] Patient Name:', patientName);

    try {
      const call = await this.client.calls.create({
        from: this.configService.get<string>('TWILIO_PHONE_NUMBER'),
        to,
        twiml: `<Response><Say language="pt-BR">Aqui é o sistema de monitoramento. O paciente ${patientName} sofreu uma queda. Por favor, entre em contato imediatamente.</Say></Response>`
      });

      return call;
    } catch (error: any) {
      throw error;
    }
  }

  
}