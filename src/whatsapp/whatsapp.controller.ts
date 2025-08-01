import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';

@ApiTags('whatsapp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Post('send')
  async sendMessage(@Body() body: { phone: string; message: string }) {
    return this.whatsappService.enviarTexto(body.phone, body.message);
  }
}
