// fall-alerts.controller.ts
import { Controller, Post, Body, Get, Query, Patch, Param, BadRequestException, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { FallAlertsService } from './fall-alerts.service';
import { CreateFallAlertDto } from './dtos/create-fall-alert.dto';
import { PrismaService } from '@src/prisma/prisma.service';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';

@ApiTags('Alertas de Queda')
@Controller('fall-alerts')
export class FallAlertsController {
  constructor(
    private readonly fallAlertsService: FallAlertsService,
    private readonly prismaService: PrismaService,
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Criar alerta de queda',
    description: 'Endpoint para dispositivos ESP32 enviarem alertas de queda detectados'
  })
  @ApiBody({ type: CreateFallAlertDto })
  async createAlert(@Body() data: CreateFallAlertDto) {
    return this.fallAlertsService.createAlert(data);
  }

  @Get()
  @ApiOperation({
    summary: 'Listar alertas por paciente',
    description: 'Retorna todos os alertas de queda de um paciente específico'
  })
  @ApiQuery({
    name: 'patientId',
    description: 'UUID do paciente',
    type: 'string',
    required: true,
  })
  async getAlerts(@Query('patientId') patientId: string) {
    if (!patientId) {
      throw new BadRequestException('O ID do paciente é obrigatório');
    }

    return this.fallAlertsService.getAlertsByPatient(patientId);
  }

  @Post('register-push-token')
@UseGuards(JwtAuthGuard)
async registerPushToken(
  @Req() req,
  @Body('token') token: string
) {
  console.log('[BACKEND] req.user:', req.user);
  
  if (!token) {
    throw new BadRequestException('Token é obrigatório');
  }

  // ✅ USA "userId" em vez de "id"
  const userId = req.user.userId; // ← MUDOU AQUI
  
  if (!userId) {
    throw new BadRequestException('Usuário não autenticado');
  }

  console.log('[BACKEND] User ID:', userId);

  try {
    const existingToken = await this.prismaService.pushToken.findUnique({
      where: { token },
    });

    if (existingToken && existingToken.userId !== userId) {
      console.log(`Token transferido de ${existingToken.userId} para ${userId}`);
    }

    const pushToken = await this.prismaService.pushToken.upsert({
      where: { token },
      update: { 
        userId, 
        updatedAt: new Date() 
      },
      create: { 
        userId, 
        token 
      },
    });

    console.log(`Token salvo! ID: ${pushToken.id}`);

    return {
      success: true,
      message: 'Token registrado com sucesso',
      data: {
        tokenId: pushToken.id,
        registeredAt: pushToken.createdAt,
      }
    };
  } catch (error) {
    console.error('Erro ao registrar token:', error);
    throw new BadRequestException('Erro ao registrar token');
  }
}


  //  Marcar como falso alerta
  @Patch(':id/false-alarm')
  @ApiOperation({
    summary: 'Marcar alerta como falso',
    description: 'Cuidador marca o alerta como falso alarme'
  })
  async markFalseAlarm(
    @Param('id') id: string,
    @Body() body: { caregiverId: string }
  ) {
    if (!body.caregiverId) {
      throw new BadRequestException('O ID do cuidador é obrigatório');
    }
    return this.fallAlertsService.markFalseAlarm(id, body.caregiverId);
  }

  //  Marcar como "estou indo verificar"
  @Patch(':id/verifying')
  @ApiOperation({
    summary: 'Marcar que está verificando',
    description: 'Cuidador indica que está indo verificar o paciente'
  })
  async markVerifying(
    @Param('id') id: string,
    @Body() body: { caregiverId: string }
  ) {
    if (!body.caregiverId) {
      throw new BadRequestException('O ID do cuidador é obrigatório');
    }
    return this.fallAlertsService.markVerifying(id, body.caregiverId);
  }

  //  Confirmar após verificação
  @Patch(':id/confirm-after-verification')
  @ApiOperation({
    summary: 'Confirmar alerta após verificação',
    description: 'Cuidador confirma o alerta após verificar pessoalmente'
  })
  async confirmAfterVerification(
    @Param('id') id: string,
    @Body() body: { caregiverId: string }
  ) {
    if (!body.caregiverId) {
      throw new BadRequestException('O ID do cuidador é obrigatório');
    }
    return this.fallAlertsService.confirmAfterVerification(id, body.caregiverId);
  }

  @Patch(':id/confirm')
  @ApiOperation({
    summary: 'Confirmar alerta automaticamente',
    description: 'Marca um alerta como confirmado (usado pelo sistema)'
  })
  async confirmAlert(@Param('id') id: string) {
    return this.fallAlertsService.confirmAlert(id);
  }
}
