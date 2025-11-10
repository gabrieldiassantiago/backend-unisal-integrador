import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { PrismaService } from 'src/prisma/prisma.service';
import { JwtStrategy } from './jwt.strategy';
import { SessionService } from './session.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'segredo123',
      signOptions: { expiresIn: '30d' }, 
    }),
  ],
  providers: [AuthService, PrismaService, JwtStrategy, SessionService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
