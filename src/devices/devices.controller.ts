import { Controller, Post, Body, ConflictException, Param, Get, Patch, HttpCode, HttpStatus } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { PairDeviceDto } from './dtos/pair-device.dto';
import { DeviceHeartbeatDto } from './dtos/device-heartbeat.dto';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { existingDevicePair } from '@src/errors/existingDevicePair';
import { noFoundUser } from '@src/errors/noFoundUser';

@ApiTags('Dispositivo (ESP32)')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) { }

  @ApiOperation({
    summary: 'Associar um dispositivo a um usuário',
    description: 'Associa um dispositivo ao usuário com base no ID do usuário, número de série e chave de API.',
  })

  @Post('pair')
  async pair(@Body() data: PairDeviceDto) {
    try {
      return await this.devicesService.pairDevice(data);
    } catch (err) {
      if (err instanceof existingDevicePair || err instanceof noFoundUser) {
        throw new ConflictException(err.message);
      }
      throw err;
    }
  }

  @ApiOperation({
    summary: 'Heartbeat do ESP32',
    description: 'Endpoint para o ESP32 enviar status periodicamente (online, bateria, sinal, etc)',
  })
  @Post('heartbeat')
  @HttpCode(HttpStatus.OK)
  async heartbeat(@Body() data: DeviceHeartbeatDto) {
    try {
      return await this.devicesService.processHeartbeat(data);
    } catch (err) {
      if (err instanceof Error) {
        throw new ConflictException(err.message);
      }
      throw err;
    }
  }

  @ApiOperation({
    summary: 'Obter status de um dispositivo',
    description: 'Retorna status completo de um dispositivo (online, bateria, último heartbeat, etc)',
  })
  @Get('status/:deviceId')
  async getStatus(@Param('deviceId') deviceId: string) {
    return this.devicesService.getDeviceStatus(deviceId);
  }

  @Get('by-user/:userId')
  listByUser(@Param('userId') userId: string) {
    return this.devicesService.listDevicesByUser(userId);
  }

  @Patch('deactivate/:deviceId/:userId')
  async deactivate(
    @Param('deviceId') deviceId: string,
    @Param('userId') userId: string
  ) {
    return this.devicesService.deactivateDevice(deviceId, userId);
  }

  @ApiOperation({
    summary: 'Verificar dispositivos offline',
    description: 'Endpoint interno para verificar e marcar dispositivos offline',
  })
  @Post('check-offline')
  @HttpCode(HttpStatus.OK)
  async checkOffline() {
    return this.devicesService.checkOfflineDevices();
  }

  @ApiOperation({
    summary: 'Buscar todos os devices de um paciente',
    description: 'Retorna lista completa de dispositivos pareados ao paciente com status em tempo real',
  })
  @Get('patient/:patientId')
  async getPatientDevices(@Param('patientId') patientId: string) {
    return this.devicesService.getPatientDevices(patientId);
  }
}
