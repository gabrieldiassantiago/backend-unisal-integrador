import { Module } from "@nestjs/common";
import { ConfigModule } from '@nestjs/config';
import { TwilioService } from "./twilio.service";
import { VoiceController } from "./voice.controller";
import { MessagingModule } from '../messaging/messaging.module';

@Module({
  imports: [ConfigModule, MessagingModule],
  providers: [TwilioService],
  controllers: [VoiceController],
  exports: [TwilioService],
})
export class TwilioModule {}
