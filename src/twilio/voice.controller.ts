import { Controller, Get, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { twiml } from 'twilio';
import { ConfigService } from '@nestjs/config';
import { TwilioService } from './twilio.service';

@Controller('voice')
export class VoiceController {
  constructor(
    private readonly configService: ConfigService,
    private readonly twilioService: TwilioService
  ) {}

  @Get()
  async getVoice(@Query('patientName') patientName: string, @Res() res: Response) {
    const voiceResponse = new twiml.VoiceResponse();

    try {
      voiceResponse.say(
        { 
          language: 'pt-BR', 
          voice: 'Polly.Camila' 
        },
        `Aqui é o sistema de monitoramento. O paciente ${patientName} sofreu uma queda. Por favor, entre em contato imediatamente.`
      );
    } catch (error) {
      console.log('[VoiceController] Voz premium não disponível, usando voz padrão');
      
      voiceResponse.say(
        { language: 'pt-BR' },
        `Aqui é o sistema de monitoramento. O paciente ${patientName} sofreu uma queda. Por favor, entre em contato imediatamente.`
      );
    }

    res.type('text/xml');
    res.send(voiceResponse.toString());
  }
}