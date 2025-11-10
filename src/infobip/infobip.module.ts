import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InfobipService } from './infobip.service';
import { InfobipTestController } from './infobip-test.controller';

@Module({
  imports: [ConfigModule],
  controllers: [InfobipTestController],
  providers: [InfobipService],
  exports: [InfobipService],
})
export class InfobipModule {}
