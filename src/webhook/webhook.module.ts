import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { FallAlertsService } from '../fall-alerts/fall-alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import { FallAlertsGateway } from '../fall-alerts/fall-alerts.gateway';
import { BullModule } from '@nestjs/bullmq';
import { FamilyModule } from '../family/family.module';
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'fall-alerts',
    }),
    FamilyModule,
    MessagingModule,
  ],
  controllers: [WebhookController],
  providers: [
    FallAlertsService,
    PrismaService,
    FallAlertsGateway,
  ],
})
export class WebhookModule {}
