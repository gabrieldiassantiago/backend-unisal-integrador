import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { LoginResponseDto } from './dtos/login-response.dto';
import { SessionService } from './session.service';
import { Role } from '../../generated/prisma';

interface ValidatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private sessionService: SessionService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<ValidatedUser | { message: string }> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      this.logger.warn(`Tentativa de login falhou: usuário não encontrado - ${email}`);
      return { message: 'Usuário não encontrado' };
    }

    if (user.role !== Role.CAREGIVER && user.role !== Role.FAMILY_MEMBER) {
      this.logger.warn(`Tentativa de login negada: papel inválido - ${email}, papel: ${user.role}`);
      return { message: 'Acesso negado' };
    }

    if (!user.password) {
      this.logger.warn(`Tentativa de login falhou: senha não definida - ${email}`);
      return { message: 'Senha não definida' };
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      this.logger.warn(`Tentativa de login falhou: senha incorreta - ${email}`);
      return { message: 'Senha incorreta' };
    }

    this.logger.log(`Usuário validado com sucesso: ${email}`);
    const { password: _, ...result } = user;
    return result as ValidatedUser;
  }

  async login(user: ValidatedUser): Promise<LoginResponseDto> {
    const sessionId = await this.sessionService.createSession(user.id);

    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      sessionId: sessionId,
    };

    if (user.role === Role.FAMILY_MEMBER) {
      try {
        const familyRelations = await this.prisma.familyRelation.findMany({
          where: {
            familyMemberId: user.id,
            acceptedAt: { not: null },
            revokedAt: null,
          },
          include: {
            patient: { select: { id: true, name: true } },
            permissions: true,
          },
        });

        const patientAccess = familyRelations.map((relation) => ({
          patientId: relation.patientId,
          patientName: relation.patient.name,
          permissions: {
            canViewAlerts: relation.permissions?.canViewAlerts ?? true,
            canRespondAlerts: relation.permissions?.canRespondAlerts ?? false,
            canViewProfile: relation.permissions?.canViewProfile ?? true,
            canEditProfile: relation.permissions?.canEditProfile ?? false,
            canManageContacts: relation.permissions?.canManageContacts ?? false,
            canInviteFamily: relation.permissions?.canInviteFamily ?? false,
          },
        }));

        Object.assign(payload, { patientAccess });
        this.logger.log(`Login de familiar: carregadas ${patientAccess.length} entradas de acesso a pacientes`);
      } catch (error) {
        this.logger.error(`Falha ao carregar relações familiares para o usuário ${user.id}: ${error.message}`, error.stack);
        Object.assign(payload, { patientAccess: [] });
      }
    }

    this.logger.log(`Usuário logado: ${user.email} (${user.role})`);
    return {
      access_token: this.jwtService.sign(payload),
      user: payload,
    };
  }

  async logout(userId: string, expoToken?: string): Promise<{ message: string }> {
    await this.sessionService.invalidateSession(userId);

    if (expoToken) {
      await this.prisma.pushToken.delete({
        where: {
          token: expoToken,
          userId: userId,
        },
      });
      this.logger.log(`Token de push removido para o usuário: ${userId}`);
    }

    this.logger.log(`Usuário deslogado: ${userId}`);
    return {
      message: 'Logout realizado com sucesso',
    };
  }
}
