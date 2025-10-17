// fall-alerts.controller.ts
import { Controller, Post, Body, Get, Query, Patch, Param, BadRequestException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiParam } from '@nestjs/swagger';
import { FallAlertsService } from './fall-alerts.service';
import { CreateFallAlertDto } from './dtos/create-fall-alert.dto';

@ApiTags('Alertas de Queda')
@Controller('fall-alerts')
export class FallAlertsController {
  constructor(private readonly fallAlertsService: FallAlertsService) {}

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
    throw new BadRequestException('O ID o paciente é obrigatório');
  }

  return this.fallAlertsService.getAlertsByPatient(patientId);

  
}

  // 🆕 Marcar como falso alerta
  @Patch(':id/false-alarm')
  @ApiOperation({
    summary: 'Marcar alerta como falso',
    description: 'Cuidador marca o alerta como falso alarme'
  })
  async markFalseAlarm(
    @Param('id') id: string,
    @Body() body: { caregiverId: string }
  ) {
    return this.fallAlertsService.markFalseAlarm(id, body.caregiverId);
  }

  // 🆕 Marcar como "estou indo verificar"
  @Patch(':id/verifying')
  @ApiOperation({
    summary: 'Marcar que está verificando',
    description: 'Cuidador indica que está indo verificar o paciente'
  })
  async markVerifying(
    @Param('id') id: string,
    @Body() body: { caregiverId: string }
  ) {
    return this.fallAlertsService.markVerifying(id, body.caregiverId);
  }

  // 🆕 Confirmar após verificação
  @Patch(':id/confirm-after-verification')
  @ApiOperation({
    summary: 'Confirmar alerta após verificação',
    description: 'Cuidador confirma o alerta após verificar pessoalmente'
  })
  async confirmAfterVerification(
    @Param('id') id: string,
    @Body() body: { caregiverId: string }
  ) {
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
