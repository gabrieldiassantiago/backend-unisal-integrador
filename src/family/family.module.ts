import { Module } from '@nestjs/common';
import { FamilyService } from './family.service';
import { FamilyController } from './family.controller';
import { JwtModule } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'segredo123',
      signOptions: { expiresIn: '30d' },
    }),
  ],
  providers: [FamilyService, PrismaService],
  controllers: [FamilyController],
  exports: [FamilyService],
})
export class FamilyModule {}