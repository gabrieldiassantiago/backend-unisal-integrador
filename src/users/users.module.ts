import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { EmailModule } from '@src/email/email.module';
import { EmailVerificationCleanupJob } from './jobs/email-verification-cleanup.job';

@Module({
  imports: [EmailModule],
  providers: [UsersService, PrismaService, EmailVerificationCleanupJob],
  controllers: [UsersController]
})
export class UsersModule { }
