import { Module } from '@nestjs/common';
import { CaregiverController } from './caregiver.controller';
import { CaregiverService } from './caregiver.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from '@src/auth/wt-auth.guard';

@Module({
  imports: [JwtModule.register({})],
  controllers: [CaregiverController],
  providers: [CaregiverService, PrismaService, JwtAuthGuard],
})
export class CaregiverModule {}
