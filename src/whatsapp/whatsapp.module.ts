import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { WhatsappController } from './whatsapp.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  providers: [WhatsAppService, PrismaService],
  controllers: [WhatsappController],
})
export class WhatsappModule {}
