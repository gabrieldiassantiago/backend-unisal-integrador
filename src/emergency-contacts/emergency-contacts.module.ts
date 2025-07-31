import { Module } from '@nestjs/common';
import { EmergencyContactsService } from './emergency-contacts.service';
import { EmergencyContactsController } from './emergency-contacts.controller';
import { PrismaService } from 'src/prisma/prisma.service';

@Module({
  providers: [EmergencyContactsService, PrismaService],
  controllers: [EmergencyContactsController]
})
export class EmergencyContactsModule {}
