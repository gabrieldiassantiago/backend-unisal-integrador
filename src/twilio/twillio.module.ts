import { Module } from "@nestjs/common";
import { TwilioService } from "./twilio.service";
import { VoiceController } from "./voice.controller";

@Module({
  imports: [],
  providers: [TwilioService],
  controllers: [VoiceController],
  exports: [TwilioService],
})
export class TwilioModule {}
