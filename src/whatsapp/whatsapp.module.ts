import { Module } from '@nestjs/common';
import { WhatsAppService } from './whatsapp.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  providers: [WhatsAppService, PrismaService],
})
export class WhatsappModule {}
