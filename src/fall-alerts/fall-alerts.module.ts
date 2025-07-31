import { Module } from '@nestjs/common';
import { FallAlertsService } from './fall-alerts.service';
import { FallAlertsController } from './fall-alerts.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { WhatsAppService } from 'src/whatsapp/whatsapp.service';

@Module({
  providers: [FallAlertsService, PrismaService, WhatsAppService],
  controllers: [FallAlertsController]
})
export class FallAlertsModule {}
