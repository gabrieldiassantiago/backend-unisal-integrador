import { Controller, Post, Body, ConflictException, Param, Get, Patch } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { PairDeviceDto } from './dtos/pair-device.dto';
import { existingDevicePair } from 'src/errors/existingDevicePair';
import { noFoundUser } from 'src/errors/noFoundUser';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

@ApiTags('Dispositivo (ESP32)')
@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

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
}
