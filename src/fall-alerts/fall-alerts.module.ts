// src/fall-alerts/fall-alerts.module.ts
import { Module } from '@nestjs/common';
import { FallAlertsService } from './fall-alerts.service';
import { FallAlertsController } from './fall-alerts.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { FallAlertsGateway } from './fall-alerts.gateway';
import { FallAlertsProcessor } from './fall-alerts.processor';
import { BullModule } from '@nestjs/bullmq';
import { TwilioService } from 'src/twilio/twilio.service';
import { FamilyModule } from 'src/family/family.module';

@Module({
  providers: [
    FallAlertsService,
    PrismaService,
    FallAlertsGateway,
    FallAlertsProcessor,
    TwilioService,
  ],
  controllers: [FallAlertsController],
  imports: [
    BullModule.registerQueue({
      name: 'fall-alerts',
    }),
    FamilyModule,
  ],
})
export class FallAlertsModule {}
