import { Controller, Post, Body, Get, Query, Patch, Param } from '@nestjs/common';
import { FallAlertsService } from './fall-alerts.service';
import { CreateFallAlertDto } from './dtos/create-fall-alert.dto';

@Controller('fall-alerts')
export class FallAlertsController {
  constructor(private readonly fallAlertsService: FallAlertsService) {}

  // Endpoint para hardware enviar alerta de queda
  @Post()
  async createAlert(@Body() data: CreateFallAlertDto) {
    return this.fallAlertsService.createAlert(data);
  }

  // Listar alertas por paciente (para o app/cuidador)
  @Get()
  async getAlerts(@Query('patientId') patientId: string) {
    return this.fallAlertsService.getAlertsByPatient(patientId);
  }

  // Confirmar alerta (paciente clicou "Estou bem")
  @Patch(':id/confirm')
  async confirmAlert(@Param('id') id: string) {
    return this.fallAlertsService.confirmAlert(id);
  }
}
