import { Module } from '@nestjs/common';
import { FallAlertsService } from './fall-alerts.service';
import { FallAlertsController } from './fall-alerts.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { WhatsAppService } from 'src/whatsapp/whatsapp.service';
import { FallAlertsGateway } from './fall-alerts.gateway';

@Module({
  providers: [FallAlertsService, PrismaService, WhatsAppService, FallAlertsGateway],
  controllers: [FallAlertsController]
})
export class FallAlertsModule {}
