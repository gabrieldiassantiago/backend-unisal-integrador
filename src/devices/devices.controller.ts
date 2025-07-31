import { Controller, Post, Body, ConflictException, Param, Get } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { PairDeviceDto } from './dtos/pair-device.dto';
import { existingDevicePair } from 'src/errors/existingDevicePair';
import { noFoundUser } from 'src/errors/noFoundUser';

@Controller('devices')
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('pair')
  async pair(@Body() data: PairDeviceDto) {
    try {
      return await this.devicesService.pairDevice(data);
    } catch (err) {
      if (err instanceof existingDevicePair) {
        throw new ConflictException(err.message);
      }
      if (err instanceof noFoundUser) {
        throw new ConflictException(err.message);
      }
      throw err; 
    }
  }

  @Get('by-user/:userId')
  listByUser(@Param('userId') userId: string) {
    return this.devicesService.listDevicesByUser(userId);
  }
}
