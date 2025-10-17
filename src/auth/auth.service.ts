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

  // Método atualizado para suportar CAREGIVER e FAMILY_MEMBER
  async validateUser(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) return null;

    // Permite login apenas de CAREGIVER e FAMILY_MEMBER (não PATIENT)
    if (user.role?.toString() !== 'CAREGIVER' && user.role?.toString() !== 'FAMILY_MEMBER') return null;

    // Verifica se tem senha definida
    if (!user.password) return null;

    // ✅ Não precisa verificar emailVerified pois usuário só é criado após verificação

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return null;

    const { password: _, ...result } = user;
    return result;
  }


  async login(user: any) {
    let payload: any = { 
      sub: user.id, 
      email: user.email, 
      role: user.role, 
      name: user.name 
    };

    // Se é familiar, incluir informações de acesso aos pacientes
    if (user.role?.toString() === 'FAMILY_MEMBER') {
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

        payload.patientAccess = patientAccess;
      } catch (error) {
        console.error('Error loading family relations:', error.message);
        // Se der erro, continua sem as informações familiares
        payload.patientAccess = [];
      }
    }

    return {
      access_token: this.jwtService.sign(payload),
      user: payload,
    };
  }

    /*
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
  */
}
