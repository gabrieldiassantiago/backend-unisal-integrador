import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { DeviceStatusGateway } from './device-status.gateway';
import { DeviceMonitorService } from './device-monitor.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  providers: [
    DevicesService, 
    PrismaService, 
    DeviceStatusGateway,
    DeviceMonitorService,
  ],
  controllers: [DevicesController],
  exports: [DeviceStatusGateway],
})
export class DevicesModule {}
