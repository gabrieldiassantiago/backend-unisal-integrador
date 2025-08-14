import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { WhatsAppService } from './whatsapp.service';
import { SendMessageDto } from './dto/send-alert-message-dto';
import { PairingCodeDto } from './dto/pairing-code-zap-dto';


@ApiTags('whatsapp')
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsAppService) {}

  @Post('send')
  @ApiOperation({
    summary: 'Enviar mensagem via WhatsApp',
    description: 'Envia uma mensagem de texto para um número de telefone específico via WhatsApp'
  })
  @ApiBody({ type: SendMessageDto })
  @ApiResponse({
    status: 200,
    description: 'Mensagem enviada com sucesso'
  })
  @ApiResponse({
    status: 400,
    description: 'Dados inválidos fornecidos'
  })
  @ApiResponse({
    status: 500,
    description: 'Erro interno do servidor ou WhatsApp não conectado'
  })
  async sendMessage(@Body() body: SendMessageDto) {
    await this.whatsappService.enviarTexto(body.phone, body.message);
    return {
      success: true,
      message: 'Mensagem enviada com sucesso',
      phone: body.phone
    };
  }

  @Post('pairing-code')
  @ApiOperation({
    summary: 'Gerar código de pareamento',
    description: 'Gera um código de pareamento para conectar o WhatsApp sem QR Code'
  })
  @ApiBody({ type: PairingCodeDto })
  @ApiResponse({
    status: 200,
    description: 'Código de pareamento gerado com sucesso',
    schema: {
      type: 'object',
      properties: {
        pairingCode: {
          type: 'string',
          example: 'ABC123',
          description: 'Código de pareamento de 6 caracteres'
        }
      }
    }
  })
  @ApiResponse({
    status: 400,
    description: 'Número de telefone inválido'
  })
  @ApiResponse({
    status: 500,
    description: 'Erro interno do servidor ou WhatsApp não inicializado'
  })
  async generatePairCode(@Body() body: PairingCodeDto) {
    const code = await this.whatsappService.gerarPairingCode(body.phone);
    return { 
      pairingCode: code,
      phone: body.phone,
      message: 'Código de pareamento gerado com sucesso'
    };
  }
}
