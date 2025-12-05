import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { DevicesModule } from './devices/devices.module';
import { FallAlertsModule } from './fall-alerts/fall-alerts.module';
import { EmergencyContactsModule } from './emergency-contacts/emergency-contacts.module';
import { AuthModule } from './auth/auth.module';
import { BullModule } from '@nestjs/bullmq';
import { ScheduleModule } from '@nestjs/schedule';
import { CaregiverModule } from './caregiver/caregiver.module';
import { PatientModule } from './patient/patient.module';
import { FamilyModule } from './family/family.module';
import { ConfigModule } from '@nestjs/config';
import { TwilioModule } from './twilio/twillio.module';
import { GeoModule } from './geo_reverse/geo.module';
import { InfobipModule } from './infobip/infobip.module';
import { MessagingModule } from './messaging/messaging.module';
import { WebhookModule } from './webhook/webhook.module';
import { PrismaService } from './prisma/prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    ScheduleModule.forRoot(),
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT, 10),
        password: process.env.REDIS_PASSWORD
      },
    }),
    MessagingModule,
    WebhookModule,
    InfobipModule,
    TwilioModule,
    GeoModule,
    UsersModule,
    DevicesModule,
    AuthModule,
    FallAlertsModule,
    EmergencyContactsModule,
    CaregiverModule,
    PatientModule,
    FamilyModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule { }
