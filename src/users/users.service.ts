import { BadRequestException, ConflictException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { ExistingEmailError } from '@src/errors/existingUserError';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dtos/create-user.dto';
import { PrismaService } from '@src/prisma/prisma.service';
import { EmailService } from '@src/email/email.service';
import { VerifyEmailDto } from './dtos/verify-email.dto';
import { EditUserDto } from './dtos/edit-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) { }

  /**
   * Pré-cadastro: Envia código mas NÃO cria usuário ainda
   * Usuário só será criado após verificar o email
   */

  async createUser(dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim();

    // Verifica se já existe usuário com este email
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      throw new ConflictException(`Usuário com o email ${email} já existe`);
    }

    // Verifica se já tem verificação pendente recente (últimos 2 minutos)
    const recentPending = await this.prisma.emailVerification.findFirst({
      where: {
        email,
        verified: false,
        createdAt: {
          gt: new Date(Date.now() - 2 * 60 * 1000), // Últimos 2 minutos
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (recentPending) {
      return {
        message: 'Um código de verificação foi enviado recentemente. Verifique seu email ou aguarde 2 minutos para solicitar novo código.',
        email,
        codeSentAt: recentPending.createdAt,
      };
    }

    // Hash da senha (para salvar temporariamente)
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Gera código e salva dados temporários
    await this.generateAndSendVerificationCode(email, dto.name, {
      name: dto.name,
      hashedPassword,
      role: 'CAREGIVER',
    });

    return {
      message: 'Código de verificação enviado para seu email. Verifique seu email para completar o cadastro.',
      email,
      expiresIn: '10 minutos',
    };
  }

  /**
   * Gera um código de 6 dígitos e envia por email
   * também salva os dados temporários do usuário
   */

  private async generateAndSendVerificationCode(
    email: string,
    userName: string,
    tempUserData?: { name: string; hashedPassword: string; role: string }
  ): Promise<void> {
    // Gera código de 6 dígitos
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Define expiração (10 minutos)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // Invalida códigos anteriores não verificados deste email
    await this.prisma.emailVerification.updateMany({
      where: {
        email,
        verified: false,
      },
      data: {
        verifiedAt: new Date(), // Marca como usado para invalidar
      },
    });

    // Cria novo código com dados temporários
    const createdVerification = await this.prisma.emailVerification.create({
      data: {
        email,
        code,
        expiresAt,
        tempUserData: tempUserData ? tempUserData : undefined,
      },
    });

    // Envia email
    try {
      await this.emailService.sendVerificationCode(email, code, userName);
    } catch (error) {
      // Se falhar o envio, remove o registro para não bloquear o usuário
      await this.prisma.emailVerification.delete({
        where: { id: createdVerification.id },
      });
      throw error;
    }
  }

  /**
   * Verifica o código de email e CRIA o usuário
   */
  async verifyEmail(dto: VerifyEmailDto): Promise<{ message: string; verified: boolean; user?: any }> {
    const email = dto.email.toLowerCase().trim();

    // Busca código válido
    const verification = await this.prisma.emailVerification.findFirst({
      where: {
        email,
        code: dto.code,
        verified: false,
        verifiedAt: null, // Não foi invalidado
        expiresAt: {
          gt: new Date(), // Ainda não expirou
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!verification) {
      // Incrementa tentativas em todos os códigos com este código
      await this.prisma.emailVerification.updateMany({
        where: {
          email,
          code: dto.code,
        },
        data: {
          attempts: {
            increment: 1,
          },
        },
      });

      throw new BadRequestException('Código inválido ou expirado');
    }

    return this.prisma.$transaction(async (tx) => {
      // Marca código como verificado
      await tx.emailVerification.update({
        where: { id: verification.id },
        data: {
          verified: true,
          verifiedAt: new Date(),
        },
      });

      // criar usuario já que foi verificado
      if (verification.tempUserData) {
        const userData = verification.tempUserData as any;

        const user = await tx.user.create({
          data: {
            name: userData.name,
            email,
            password: userData.hashedPassword,
            role: userData.role,
            hasAccount: true,
            emailVerified: true,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            hasAccount: true,
            emailVerified: true,
            createdAt: true
          },
        });

        return {
          message: 'Email verificado com sucesso! Sua conta foi criada. Agora você pode fazer login.',
          verified: true,
          user,
        };
      }

      // Se não tem dados temporários, é uma verificação de email existente
      await tx.user.update({
        where: { email },
        data: {
          emailVerified: true,
        },
      });

      return {
        message: 'Email verificado com sucesso! Agora você pode fazer login.',
        verified: true,
      };
    });
  }

  /**
   * Reenvia código de verificação
   */

  async resendVerificationCode(email: string): Promise<{ message: string }> {
    const normalizedEmail = email.toLowerCase().trim();

    // Verifica se usuário já existe
    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (user) {
      if (user.emailVerified) {
        throw new BadRequestException('Email já verificado. Você pode fazer login.');
      }

      // Se usuário existe mas não verificado, reenvia código
      await this.generateAndSendVerificationCode(normalizedEmail, user.name);

      return {
        message: 'Novo código enviado para seu email',
      };
    }

    // Busca verificação pendente
    const pendingVerification = await this.prisma.emailVerification.findFirst({
      where: {
        email: normalizedEmail,
        verified: false,
        verifiedAt: null,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!pendingVerification) {
      throw new BadRequestException('Nenhum cadastro pendente encontrado para este email');
    }

    // Verifica limite de reenvios (máximo 5 códigos não expirados nas últimas 24h)
    const recentCodes = await this.prisma.emailVerification.count({
      where: {
        email: normalizedEmail,
        createdAt: {
          gt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Últimas 24h
        },
      },
    });

    if (recentCodes >= 5) {
      throw new BadRequestException('Limite de códigos excedido. Tente novamente em 24 horas.');
    }

    // Extrai dados temporários para reenvio
    const tempData = pendingVerification.tempUserData as any;

    // Gera e envia novo código
    await this.generateAndSendVerificationCode(
      normalizedEmail,
      tempData?.name || 'Usuário',
      tempData
    );

    return {
      message: 'Novo código enviado para seu email',
    };
  }

  async getAllUsers() {
    return this.prisma.user.findMany({
      include: {
        devices: true,
        fallAlerts: true,
        contacts: true,
        caregivers: true,
        patients: true,
        familyMemberRelations: true,
        patientFamilyRelations: true
      },
    });
  }

  async getUserProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        hasAccount: true,
        createdAt: true,
        fallAlerts: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            deviceId: true,
            patientId: true,
            status: true,
            latitude: true,
            longitude: true,
            createdAt: true,
            confirmedAt: true,
            location: true,
            confirmedByContactId: true,
            confirmationMethod: true,
          },
        },
        devices: true,
        contacts: true,
        patients: {
          select: {
            id: true, // id da relação pivot (ex: caregiverPatient)
            patient: {
              select: {
                id: true,
                name: true,
                birthDate: true,
                gender: true,
                hasAccount: true,
                _count: {
                  select: { fallAlerts: true },
                },
                fallAlerts: {
                  orderBy: { createdAt: 'desc' },
                  select: {
                    id: true,
                    deviceId: true,
                    patientId: true,
                    status: true,
                    latitude: true,
                    longitude: true,
                    createdAt: true,
                    confirmedAt: true,
                    location: true,
                    confirmedByContactId: true,
                    confirmationMethod: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return user;
  }

  /**
   * Edita os dados de um usuário
   */

  async editUser(id: string, dto: EditUserDto) {
    // Verifica se o usuário existe
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      throw new NotFoundException('Usuário não encontrado');
    }

    // Verifica se está tentando alterar o email para um que já existe
    if (dto.email && dto.email !== existingUser.email) {
      const normalizedEmail = dto.email.toLowerCase().trim();

      const emailInUse = await this.prisma.user.findUnique({
        where: { email: normalizedEmail },
      });

      if (emailInUse) {
        throw new ConflictException('Este email já está em uso por outro usuário');
      }
    }

    // Prepara os dados para atualização
    const updateData: any = {};

    if (dto.name !== undefined) {
      updateData.name = dto.name;
    }

    if (dto.email !== undefined) {
      updateData.email = dto.email.toLowerCase().trim();
      // Se mudar email, precisa reverificar
      updateData.emailVerified = false;
    }

    if (dto.password !== undefined) {
      // Hash da nova senha
      updateData.password = await bcrypt.hash(dto.password, 10);
    }

    if (dto.birthDate !== undefined) {
      updateData.birthDate = new Date(dto.birthDate);
    }

    if (dto.gender !== undefined) {
      updateData.gender = dto.gender;
    }

    // Atualiza o usuário
    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        birthDate: true,
        gender: true,
        hasAccount: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    // Se o email foi alterado, envia código de verificação
    if (dto.email && dto.email !== existingUser.email) {
      await this.generateAndSendVerificationCode(
        updatedUser.email!,
        updatedUser.name
      );
    }

    return {
      message: dto.email && dto.email !== existingUser.email
        ? 'Usuário atualizado com sucesso! Um código de verificação foi enviado para o novo email.'
        : 'Usuário atualizado com sucesso!',
      user: updatedUser,
      emailChanged: dto.email && dto.email !== existingUser.email,
    };
  }
}
