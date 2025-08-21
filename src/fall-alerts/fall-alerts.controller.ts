import { Controller, Post, Body, Get, Query, Patch, Param } from '@nestjs/common';
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
  @ApiResponse({
    status: 201,
    description: 'Alerta de queda criado com sucesso',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'IGNORED'], example: 'PENDING' },
        latitude: { type: 'number', example: -23.5505 },
        longitude: { type: 'number', example: -46.6333 },
        location: { type: 'string', example: 'São Paulo, SP' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    }
  })
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
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de alertas do paciente',
    schema: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['PENDING', 'CONFIRMED', 'IGNORED'] },
          latitude: { type: 'number' },
          longitude: { type: 'number' },
          location: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' }
        }
      }
    }
  })
  async getAlerts(@Query('patientId') patientId: string) {
    return this.fallAlertsService.getAlertsByPatient(patientId);
  }

  @Patch(':id/confirm')
  @ApiOperation({
    summary: 'Confirmar alerta',
    description: 'Marca um alerta como confirmado (paciente está bem)'
  })
  @ApiParam({
    name: 'id',
    description: 'UUID do alerta',
    type: 'string',
    example: '123e4567-e89b-12d3-a456-426614174000'
  })
  @ApiResponse({
    status: 200,
    description: 'Alerta confirmado com sucesso',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        status: { type: 'string', example: 'CONFIRMED' },
        confirmedAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  async confirmAlert(@Param('id') id: string) {
    return this.fallAlertsService.confirmAlert(id);
  }
}
