import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { DevicesModule } from './devices/devices.module';
import { FallAlertsModule } from './fall-alerts/fall-alerts.module';
import { EmergencyContactsModule } from './emergency-contacts/emergency-contacts.module';
import { AuthModule } from './auth/auth.module';
import { BullModule } from '@nestjs/bullmq';
import { CaregiverModule } from './caregiver/caregiver.module';
import { PatientModule } from './patient/patient.module';
import { FamilyModule } from './family/family.module';
import { ConfigModule } from '@nestjs/config';
import { TwilioModule } from './twilio/twillio.module';

@Module({
  imports: [
    UsersModule,
    DevicesModule,
    AuthModule,
    FallAlertsModule,
    EmergencyContactsModule,
    CaregiverModule,
    PatientModule,
    FamilyModule,
    TwilioModule, 
    ConfigModule.forRoot({
      isGlobal: true
    }),

    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT, 10),
        password: 'intelisensor',
      },
    }),

  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
