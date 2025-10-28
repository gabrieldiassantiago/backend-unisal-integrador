// jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  
  constructor(private prisma: PrismaService) { 
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'segredo123',
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { 
        currentSessionId: true,
        role: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Usuário não encontrado');
    }

    if (!payload.sessionId) {
      throw new UnauthorizedException('Token inválido');
    }

    if (user.currentSessionId !== payload.sessionId) {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }

    return { 
      userId: payload.sub, 
      email: payload.email, 
      role: payload.role,
      sessionId: payload.sessionId,
    };
  }
}
