import { Module } from '@nestjs/common';
import { DevicesService } from './devices.service';
import { DevicesController } from './devices.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  providers: [DevicesService, PrismaService],
  controllers: [DevicesController]
})
export class DevicesModule {}
