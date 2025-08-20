import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {PrismaService} from '../prisma/prisma.service'
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  // auth.service.ts
    async validateUser(email: string, password: string) {
      const user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) return null;

      // impede login de paciente por e-mail
      if (user.role !== 'CAREGIVER') return null;

      const ok = await bcrypt.compare(password, user.password);
      if (!ok) return null;

      const { password: _, ...result } = user;
      return result;
    }


    async login(user: any) {

    const payload = { sub: user.id, email: user.email, role: user.role, name: user.name };
    return {
      access_token: this.jwtService.sign(payload),
      user: payload,
    };
    
  }

    async resetPassword(email: string, password: string) {
    const user = await this.prisma.user.findUnique({where: {email}});

    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await this.prisma.user.update({
      where: {email},
      data: {
        password: hashedPassword
      }
    })
    return {
      message: 'Senha resetada com sucesso',
    }
  }


}
