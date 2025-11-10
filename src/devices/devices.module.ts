import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { DeviceStatusGateway } from './device-status.gateway';
import { DeviceMonitorService } from './device-monitor.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { MessagingService } from '@src/messaging/messaging.service';

@Module({
  providers: [
    DevicesService, 
    PrismaService, 
    DeviceStatusGateway,
    DeviceMonitorService,
    MessagingService
  ],
  controllers: [DevicesController],
  exports: [DeviceStatusGateway],
})
export class DevicesModule {}
