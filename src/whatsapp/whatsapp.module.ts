import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { WhatsappController } from './whatsapp.controller';

@Module({
  controllers: [WhatsappController],
  providers: [WhatsAppService, PrismaService],
})
export class WhatsappModule {}
