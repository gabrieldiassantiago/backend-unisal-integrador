import { Module } from '@nestjs/common';
import { FallAlertsService } from './fall-alerts.service';
import { FallAlertsController } from './fall-alerts.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { WhatsAppService } from 'src/whatsapp/whatsapp.service';
import { FallAlertsGateway } from './fall-alerts.gateway';
import { FallAlertsProcessor } from './fall-alerts.processor';
import { BullModule } from '@nestjs/bullmq';

@Module({
  providers: [FallAlertsService, PrismaService, WhatsAppService, FallAlertsGateway, FallAlertsProcessor],
  controllers: [FallAlertsController],
  imports: [
    BullModule.registerQueue({
      name: 'fall-alerts'
    })
  ]
})

export class FallAlertsModule {}
