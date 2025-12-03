import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { JwtService } from '@nestjs/jwt';
import { InviteFamilyMemberDto } from './dtos/invite-family-member.dto';
import { AcceptFamilyInviteDto } from './dtos/accept-family-invite.dto';
import { UpdateFamilyPermissionsDto } from './dtos/update-family-permissions.dto';
import { FamilyMemberResponseDto, FamilyPatientResponseDto } from './dtos/family-response.dto';

function normalizeCode(code?: string): string {
  if (!code) return '';
  return code.replace(/[^0-9]/g, '');
}

function generateFamilyCode(len = 8) {
  let code = '';
  for (let i = 0; i < len; i++) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

function displayCode(code: string) {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

function clampTtl(ttl?: number) {
  const raw = ttl ?? 48; // Default 48 horas para convites
  return Math.min(Math.max(raw, 1), 168); // Min 1h, max 1 semana
}

// Helper para calcular idade
function calcAge(birthDate?: Date | null): number | null {
  if (!birthDate) return null;
  const diff = Date.now() - birthDate.getTime();
  const ageDt = new Date(diff);
  return Math.abs(ageDt.getUTCFullYear() - 1970);
}

@Injectable()
export class FamilyService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) { }

  async inviteFamilyMember(
    primaryCaregiverId: string,
    dto: InviteFamilyMemberDto,
  ) {
    // Debug: vamos ver o que está chegando
    console.log('🔍 DEBUG - inviteFamilyMember:');
    console.log('primaryCaregiverId:', primaryCaregiverId);
    console.log('dto:', dto);
    console.log('dto.patientId:', dto.patientId);
    console.log('typeof dto.patientId:', typeof dto.patientId);

    if (!dto.patientId) {
      throw new BadRequestException('patientId é obrigatório');
    }

    // 1. Validar se é cuidador principal do paciente
    const caregiverPatient = await this.prisma.caregiverPatient.findUnique({
      where: {
        caregiverId_patientId: {
          caregiverId: primaryCaregiverId,
          patientId: dto.patientId,
        },
      },
      include: {
        caregiver: true,
        patient: true,
      },
    });

    if (!caregiverPatient) {
      throw new ForbiddenException(
        'Você não tem permissão para convidar familiares para este paciente',
      );
    }

    if (caregiverPatient.caregiver.role !== 'CAREGIVER') {
      throw new ForbiddenException('Apenas cuidadores podem convidar familiares');
    }

    // 2. Verificar se já existe convite pendente ou relação ativa
    const existingRelation = await this.prisma.familyRelation.findFirst({
      where: {
        primaryCaregiverId,
        patientId: dto.patientId,
        familyMember: {
          email: dto.email,
        },
        revokedAt: null,
      },
    }); if (existingRelation) {
      if (existingRelation.acceptedAt) {
        throw new ConflictException('Este familiar já tem acesso ao paciente');
      } else {
        throw new ConflictException(
          'Já existe um convite pendente para este familiar',
        );
      }
    }

    const ttl = clampTtl(dto.ttlHours);
    const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      // 3. Criar ou encontrar usuário familiar
      let familyMember = await tx.user.findUnique({
        where: { email: dto.email },
      });

      if (!familyMember) {
        // Criar novo usuário familiar
        familyMember = await tx.user.create({
          data: {
            name: dto.name,
            email: dto.email,
            role: 'FAMILY_MEMBER',
            hasAccount: false,
          },
        });
      } else {
        // Verificar se já é familiar ou se precisa atualizar role
        if (familyMember.role === 'CAREGIVER') {
          throw new ConflictException(
            'Este email já está registrado como cuidador principal',
          );
        }
        if (familyMember.role === 'PATIENT') {
          throw new ConflictException(
            'Este email já está registrado como paciente',
          );
        }
      }

      // 4. Criar relação familiar
      const familyRelation = await tx.familyRelation.create({
        data: {
          primaryCaregiverId,
          familyMemberId: familyMember.id,
          patientId: dto.patientId,
          invitedAt: new Date(),
        },
      });

      // 5. Criar permissões iniciais
      await tx.familyPermissions.create({
        data: {
          relationId: familyRelation.id,
          canViewAlerts: dto.canViewAlerts ?? true,
          canRespondAlerts: dto.canRespondAlerts ?? false,
          canViewProfile: dto.canViewProfile ?? true,
          canEditProfile: dto.canEditProfile ?? false,
          canManageContacts: dto.canManageContacts ?? false,
          canInviteFamily: dto.canInviteFamily ?? false,
        },
      });

      // 6. Gerar código de convite
      const raw = normalizeCode(generateFamilyCode(8));
      const codeDigest = crypto
        .createHmac('sha256', process.env.CODE_SECRET || 'dev')
        .update(raw)
        .digest('hex');
      const codeHash = await bcrypt.hash(raw, 10);

      const inviteCode = await tx.accessCode.create({
        data: {
          codeDigest,
          codeHash,
          codeDisplay: displayCode(raw),
          type: 'FAMILY_INVITE',
          caregiverId: primaryCaregiverId,
          patientId: dto.patientId,
          familyEmail: dto.email,
          familyName: dto.name,
          expiresAt,
          maxUses: 1,
        },
      });

      return {
        inviteCode: inviteCode.codeDisplay,
        expiresAt: inviteCode.expiresAt,
        familyMember: {
          id: familyMember.id,
          name: familyMember.name,
          email: familyMember.email,
        },
        patient: {
          id: caregiverPatient.patient.id,
          name: caregiverPatient.patient.name,
        },
      };
    });
  }

  async acceptFamilyInvite(dto: AcceptFamilyInviteDto) {
    console.log('=== ACCEPT INVITE DEBUG ===');
    console.log('DTO recebido:', dto);
    console.log('Code:', dto.inviteCode);
    console.log('Password:', dto.password ? '[PRESENTE]' : '[AUSENTE]');

    // Validar se o código foi enviado
    if (!dto.inviteCode) {
      throw new BadRequestException('Código de convite é obrigatório');
    }

    const normalizedCode = normalizeCode(dto.inviteCode);
    console.log('Código normalizado:', normalizedCode);

    const digest = crypto
      .createHmac('sha256', process.env.CODE_SECRET || 'dev')
      .update(normalizedCode)
      .digest('hex');

    const accessCode = await this.prisma.accessCode.findUnique({
      where: { codeDigest: digest },
      include: {
        patient: true,
        caregiver: true,
      },
    });

    if (!accessCode || accessCode.type !== 'FAMILY_INVITE') {
      throw new NotFoundException('Código de convite inválido');
    }

    const now = new Date();
    if (
      accessCode.usedAt ||
      accessCode.expiresAt <= now ||
      accessCode.revokedAt
    ) {
      await this.prisma.accessCode.update({
        where: { id: accessCode.id },
        data: { attempts: { increment: 1 }, lastAttemptAt: now },
      });
      throw new NotFoundException('Código de convite expirado ou já utilizado');
    }

    // Verificar hash do código
    const ok = await bcrypt.compare(normalizedCode, accessCode.codeHash);
    if (!ok) {
      await this.prisma.accessCode.update({
        where: { id: accessCode.id },
        data: { attempts: { increment: 1 }, lastAttemptAt: new Date() },
      });
      throw new NotFoundException('Código de convite inválido');
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Marcar código como usado
      await tx.accessCode.update({
        where: { id: accessCode.id },
        data: { uses: { increment: 1 }, usedAt: now },
      });

      // 2. Encontrar usuário familiar
      const familyMember = await tx.user.findUnique({
        where: { email: accessCode.familyEmail },
      });

      if (!familyMember) {
        throw new NotFoundException('Usuário familiar não encontrado');
      }

      // 3. Atualizar senha do familiar e ativar conta
      const hashedPassword = await bcrypt.hash(dto.password, 10);
      await tx.user.update({
        where: { id: familyMember.id },
        data: {
          password: hashedPassword,
          hasAccount: true,
        },
      });

      // 4. Ativar relação familiar
      const familyRelation = await tx.familyRelation.findFirst({
        where: {
          familyMemberId: familyMember.id,
          patientId: accessCode.patientId,
          primaryCaregiverId: accessCode.caregiverId,
          revokedAt: null,
        },
        include: {
          permissions: true,
        },
      });

      if (!familyRelation) {
        throw new NotFoundException('Relação familiar não encontrada');
      }

      await tx.familyRelation.update({
        where: { id: familyRelation.id },
        data: { acceptedAt: now },
      });

      // 5. Gerar JWT para o familiar
      const payload = {
        sub: familyMember.id,
        email: familyMember.email,
        role: familyMember.role,
        name: familyMember.name,
      };

      const token = this.jwtService.sign(payload);

      return {
        accessToken: token,
        user: payload,
        patient: {
          id: accessCode.patient.id,
          name: accessCode.patient.name,
        },
        permissions: familyRelation.permissions,
      };
    });
  }

  async getFamilyPatients(familyMemberId: string) {
    const familyRelations = await this.prisma.familyRelation.findMany({
      where: {
        familyMemberId,
        acceptedAt: { not: null },
        revokedAt: null,
      },
      include: {
        // 👇 ALTERAÇÃO 1: Aninhar o include dos alertas dentro do paciente
        patient: {
          include: {
            fallAlerts: {
              orderBy: { createdAt: 'desc' }, // Ordenar pelos mais recentes
              take: 5, // (Opcional) Limitar aos 5 últimos para não pesar a requisição
            },
          },
        },
        permissions: true,
      },
    });

    return familyRelations.map((relation) => ({
      id: relation.patient.id,
      name: relation.patient.name,
      birthDate: relation.patient.birthDate,
      gender: relation.patient.gender,
      age: calcAge(relation.patient.birthDate),

      alerts: relation.patient.fallAlerts.map((alert) => ({
        id: alert.id,
        status: alert.status,
        createdAt: alert.createdAt,
        location: alert.location,
        latitude: alert.latitude,
        longitude: alert.longitude,
        respondedAt: alert.respondedAt,
      })),

      permissions: {
        canViewAlerts: relation.permissions?.canViewAlerts ?? true,
        canRespondAlerts: relation.permissions?.canRespondAlerts ?? false,
        canViewProfile: relation.permissions?.canViewProfile ?? true,
        canEditProfile: relation.permissions?.canEditProfile ?? false,
        canManageContacts: relation.permissions?.canManageContacts ?? false,
        canInviteFamily: relation.permissions?.canInviteFamily ?? false,
      },
    }));
  }

  async getFamilyMembersByPatient(
    primaryCaregiverId: string,
    patientId: string,
  ): Promise<FamilyMemberResponseDto[]> {
    // Verificar se é o cuidador principal
    const caregiverPatient = await this.prisma.caregiverPatient.findUnique({
      where: {
        caregiverId_patientId: {
          caregiverId: primaryCaregiverId,
          patientId: patientId,
        },
      },
    });

    if (!caregiverPatient) {
      throw new ForbiddenException(
        'Você não tem permissão para ver os familiares deste paciente',
      );
    }

    const familyRelations = await this.prisma.familyRelation.findMany({
      where: {
        primaryCaregiverId,
        patientId,
        revokedAt: null,
      },
      include: {
        familyMember: true,
        permissions: true,
      },
    });

    return familyRelations.map((relation) => ({
      id: relation.familyMember.id,
      name: relation.familyMember.name,
      email: relation.familyMember.email,
      acceptedAt: relation.acceptedAt,
      invitedAt: relation.invitedAt,
      permissions: {
        canViewAlerts: relation.permissions?.canViewAlerts ?? true,
        canRespondAlerts: relation.permissions?.canRespondAlerts ?? false,
        canViewProfile: relation.permissions?.canViewProfile ?? true,
        canEditProfile: relation.permissions?.canEditProfile ?? false,
        canManageContacts: relation.permissions?.canManageContacts ?? false,
        canInviteFamily: relation.permissions?.canInviteFamily ?? false,
      },
    }));
  }

  async updateFamilyPermissions(
    primaryCaregiverId: string,
    familyMemberId: string,
    patientId: string,
    dto: UpdateFamilyPermissionsDto,
  ) {
    const familyRelation = await this.prisma.familyRelation.findFirst({
      where: {
        primaryCaregiverId,
        familyMemberId,
        patientId,
        acceptedAt: { not: null },
        revokedAt: null,
      },
      include: {
        permissions: true,
      },
    });

    if (!familyRelation) {
      throw new NotFoundException('Relação familiar não encontrada');
    }

    return this.prisma.familyPermissions.update({
      where: { relationId: familyRelation.id },
      data: {
        canViewAlerts: dto.canViewAlerts ?? familyRelation.permissions?.canViewAlerts,
        canRespondAlerts: dto.canRespondAlerts ?? familyRelation.permissions?.canRespondAlerts,
        canViewProfile: dto.canViewProfile ?? familyRelation.permissions?.canViewProfile,
        canEditProfile: dto.canEditProfile ?? familyRelation.permissions?.canEditProfile,
        canManageContacts: dto.canManageContacts ?? familyRelation.permissions?.canManageContacts,
        canInviteFamily: dto.canInviteFamily ?? familyRelation.permissions?.canInviteFamily,
      },
    });
  }

  async revokeFamilyAccess(
    primaryCaregiverId: string,
    familyMemberId: string,
    patientId: string,
  ) {
    const familyRelation = await this.prisma.familyRelation.findFirst({
      where: {
        primaryCaregiverId,
        familyMemberId,
        patientId,
        revokedAt: null,
      },
    });

    if (!familyRelation) {
      throw new NotFoundException('Relação familiar não encontrada');
    }

    return this.prisma.familyRelation.update({
      where: { id: familyRelation.id },
      data: { revokedAt: new Date() },
    });
  }

  // Método para verificar se um usuário tem acesso a um paciente
  async hasAccessToPatient(userId: string, patientId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return false;

    // Se é CAREGIVER, verificar se é o cuidador principal
    if (user.role === 'CAREGIVER') {
      const caregiverPatient = await this.prisma.caregiverPatient.findUnique({
        where: {
          caregiverId_patientId: {
            caregiverId: userId,
            patientId: patientId,
          },
        },
      });
      return !!caregiverPatient;
    }

    // Se é FAMILY_MEMBER, verificar relação familiar ativa
    if (user.role === 'FAMILY_MEMBER') {
      const familyRelation = await this.prisma.familyRelation.findFirst({
        where: {
          familyMemberId: userId,
          patientId: patientId,
          acceptedAt: { not: null },
          revokedAt: null,
        },
      });
      return !!familyRelation;
    }

    // Se é PATIENT, verificar se é o próprio paciente
    if (user.role === 'PATIENT') {
      return userId === patientId;
    }

    return false;
  }

  // Método para obter permissões de um familiar para um paciente
  async getFamilyPermissions(familyMemberId: string, patientId: string) {
    const familyRelation = await this.prisma.familyRelation.findFirst({
      where: {
        familyMemberId,
        patientId,
        acceptedAt: { not: null },
        revokedAt: null,
      },
      include: {
        permissions: true,
      },
    });

    if (!familyRelation?.permissions) {
      return null;
    }

    return familyRelation.permissions;
  }

  // Método para obter informações completas da família de um paciente
  async getFullFamilyInfo(patientId: string, requestingUserId: string) {
    // Verificar se o usuário tem acesso ao paciente
    const hasAccess = await this.hasAccessToPatient(requestingUserId, patientId);
    if (!hasAccess) {
      throw new ForbiddenException('Você não tem acesso a este paciente');
    }

    // Buscar paciente
    const patient = await this.prisma.user.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        name: true,
        birthDate: true,
        gender: true,
        email: true,
        createdAt: true,
      },
    });

    if (!patient) {
      throw new NotFoundException('Paciente não encontrado');
    }

    // Buscar cuidador principal
    const caregiverRelation = await this.prisma.caregiverPatient.findFirst({
      where: { patientId },
      include: {
        caregiver: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            createdAt: true,
          },
        },
      },
    });

    // Buscar todos os familiares (aceitos e pendentes)
    const familyRelations = await this.prisma.familyRelation.findMany({
      where: {
        patientId,
        revokedAt: null,
      },
      include: {
        familyMember: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            hasAccount: true,
            createdAt: true,
          },
        },
        permissions: true,
        primaryCaregiver: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { acceptedAt: 'desc' }, // Aceitos primeiro
        { invitedAt: 'desc' }, // Depois por data de convite
      ],
    });

    return {
      patient: {
        id: patient.id,
        name: patient.name,
        birthDate: patient.birthDate,
        gender: patient.gender,
        email: patient.email,
        createdAt: patient.createdAt,
        age: calcAge(patient.birthDate),
      },
      primaryCaregiver: caregiverRelation
        ? {
          id: caregiverRelation.caregiver.id,
          name: caregiverRelation.caregiver.name,
          email: caregiverRelation.caregiver.email,
          role: caregiverRelation.caregiver.role,
          createdAt: caregiverRelation.caregiver.createdAt,
          relationId: caregiverRelation.id,
          relationCreatedAt: caregiverRelation.createdAt,
        }
        : null,
      familyMembers: familyRelations.map((relation) => ({
        id: relation.familyMember.id,
        name: relation.familyMember.name,
        email: relation.familyMember.email,
        role: relation.familyMember.role,
        hasAccount: relation.familyMember.hasAccount,
        createdAt: relation.familyMember.createdAt,
        invitedAt: relation.invitedAt,
        acceptedAt: relation.acceptedAt,
        status: relation.acceptedAt ? 'accepted' : 'pending',
        invitedBy: {
          id: relation.primaryCaregiver.id,
          name: relation.primaryCaregiver.name,
          email: relation.primaryCaregiver.email,
        },
        permissions: relation.permissions
          ? {
            canViewAlerts: relation.permissions.canViewAlerts,
            canRespondAlerts: relation.permissions.canRespondAlerts,
            canViewProfile: relation.permissions.canViewProfile,
            canEditProfile: relation.permissions.canEditProfile,
            canManageContacts: relation.permissions.canManageContacts,
            canInviteFamily: relation.permissions.canInviteFamily,
          }
          : null,
      })),
    };
  }

  async deleteFamilyMemberCompletely(
    primaryCaregiverId: string,
    familyMemberId: string,
    patientId: string,
  ) {
    // 1. Validar que o solicitante é cuidador principal
    const caregiverRelation = await this.prisma.caregiverPatient.findUnique({
      where: {
        caregiverId_patientId: {
          caregiverId: primaryCaregiverId,
          patientId,
        },
      },
    });

    if (!caregiverRelation) {
      throw new ForbiddenException(
        'Você não tem permissão para remover familiares deste paciente',
      );
    }

    // 2. Encontrar relação familiar ativa ou pendente
    const relation = await this.prisma.familyRelation.findFirst({
      where: {
        primaryCaregiverId,
        familyMemberId,
        patientId,
      },
      include: {
        familyMember: true,
        permissions: true,
      },
    });

    if (!relation) {
      throw new NotFoundException('Este familiar não existe para este paciente');
    }

    // 3. Garantir que o usuário é realmente FAMILY_MEMBER
    if (relation.familyMember.role !== 'FAMILY_MEMBER') {
      throw new ConflictException(
        'Este usuário não é um familiar e não pode ser removido',
      );
    }

    // 4. Verificar se ele não possui relação com outros pacientes
    const otherRelations = await this.prisma.familyRelation.count({
      where: {
        familyMemberId,
        patientId: { not: patientId },
        revokedAt: null,
      },
    });

    if (otherRelations > 0) {
      throw new ConflictException(
        'Este familiar possui acesso a outros pacientes e não pode ser removido totalmente',
      );
    }

    // 5. Executar remoção total em transação
    return this.prisma.$transaction(async (tx) => {
      // 🗑 Remover permissões
      if (relation.permissions) {
        await tx.familyPermissions.delete({
          where: { relationId: relation.id },
        });
      }

      // 🗑 Remover relação familiar
      await tx.familyRelation.delete({
        where: { id: relation.id },
      });

      // 🗑 Remover push tokens (expo notifications)
      await tx.pushToken.deleteMany({
        where: { userId: familyMemberId },
      });

      // 🗑 Remover refresh tokens (sessions)
      await tx.refreshToken.deleteMany({
        where: { userId: familyMemberId },
      });

      // 🗑 Remover códigos emitidos ou usados
      await tx.accessCode.deleteMany({
        where: {
          OR: [{ caregiverId: familyMemberId }, { patientId: familyMemberId }],
        },
      });

      // 🧨 Finalmente deletar usuário
      const deletedUser = await tx.user.delete({
        where: { id: familyMemberId },
      });

      return {
        message: 'Familiar removido permanentemente',
        removedUser: {
          id: deletedUser.id,
          name: deletedUser.name,
          email: deletedUser.email,
        },
        patientId,
      };
    });
  }

}