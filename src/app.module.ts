import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { WhatsappModule } from './whatsapp/whatsapp.module';
import { WhatsappController } from './whatsapp/whatsapp.controller';
import { DevicesModule } from './devices/devices.module';
import { FallAlertsModule } from './fall-alerts/fall-alerts.module';
import { EmergencyContactsModule } from './emergency-contacts/emergency-contacts.module';

@Module({
  imports: [UsersModule, WhatsappModule, DevicesModule, FallAlertsModule, EmergencyContactsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
