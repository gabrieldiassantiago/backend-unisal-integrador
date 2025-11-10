import { Controller, Post, Body, Get } from '@nestjs/common';
import { InfobipService } from './infobip.service';

@Controller('infobip-test')
export class InfobipTestController {
  constructor(private readonly infobipService: InfobipService) {}

  /**
   * Testar envio RAW igual ao cURL que funciona
   * POST /infobip-test/send-raw
   */
  @Post('send-raw')
  async sendRaw(@Body() body: { to: string; name: string }) {
    const axios = require('axios');
    
    const payload = {
      messages: [
        {
          from: "447860088970",
          to: body.to,
          messageId: `test-${Date.now()}`,
          content: {
            templateName: "test_whatsapp_template_en",
            templateData: {
              body: {
                placeholders: [body.name || "Gabriel"]
              }
            },
            language: "en"
          }
        }
      ]
    };

    console.log('📦 Payload:', JSON.stringify(payload, null, 2));

    try {
      const response = await axios.post(
        'https://g9v8jj.api.infobip.com/whatsapp/1/message/template',
        payload,
        {
          headers: {
            'Authorization': `App ${process.env.INFOBIP_API_KEY}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          }
        }
      );

      console.log('✅ Resposta:', JSON.stringify(response.data, null, 2));
      return response.data;
    } catch (error: any) {
      console.error('❌ Erro:', error.response?.data || error.message);
      throw error;
    }
  }

  /**
   * Testar envio usando template de teste pré-aprovado
   * POST /infobip-test/send-template-test
   */
  @Post('send-template-test')
  async sendTemplateTest(@Body() body: { to: string; name: string }) {
    return await this.infobipService.sendFallAlert(body.to, {
      contactName: 'Teste',
      patientName: body.name || 'Gabriel',
      location: 'https://maps.google.com/?q=-23.5505,-46.6333',
      priority: 1,
    });
  }

  /**
   * Testar envio de mensagem de texto (só funciona com janela de 24h ativa)
   * POST /infobip-test/send-text
   */
  @Post('send-text')
  async sendText(@Body() body: { to: string; message: string }) {
    return await this.infobipService.sendTextMessage(body.to, body.message);
  }

  /**
   * Testar configuração
   * GET /infobip-test/config
   */
  @Get('config')
  async testConfig() {
    return {
      message: 'Infobip configurado! Veja os logs do servidor para detalhes.',
      sender: process.env.INFOBIP_WHATSAPP_SENDER,
      baseUrl: process.env.INFOBIP_BASE_URL,
      apiKeyConfigured: !!process.env.INFOBIP_API_KEY,
      apiKeyPreview: process.env.INFOBIP_API_KEY?.substring(0, 10) + '...',
    };
  }
}
