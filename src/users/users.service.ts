import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { ExistingEmailError } from '@src/errors/existingUserError';
import * as bcrypt from 'bcrypt';
import { CreateUserDto } from './dtos/create-user.dto';
import { PrismaService } from '@src/prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(dto: CreateUserDto) {

    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    
    if (existing) {
      throw new ExistingEmailError(`Usuário com o email ${email} já existe`);
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        password: hashedPassword,
        role: 'CAREGIVER',
        hasAccount: true,
      },
      select: { id: true, name: true, email: true, role: true, hasAccount: true, createdAt: true },
    });

    return user;
  }



  async getAllUsers() {
    return this.prisma.user.findMany({
      include: {
        devices: true,
        fallAlerts: true,
        contacts: true,
        caregivers: true,
        patients: true,
      },
    });
  }

 async getUserProfile(id: string) {
  // Busca o usuário com os relacionamentos básicos
  const user = await this.prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      hasAccount: true,
      createdAt: true,
      devices: true,
      contacts: true,
      patients: {
        select: {
          id: true,
          patient: {
            select: {
              id: true,
              name: true,
              birthDate: true,
              gender: true,
              hasAccount: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  // Puxa todos os fallAlerts de todos os pacientes vinculados ao caregiver
  const fallAlerts = await this.prisma.fallAlert.findMany({
    where: {
      patient: {
        caregivers: {
          some: { caregiverId: id },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      patient: {
        select: {
          id: true,
          name: true,
          birthDate: true,
          gender: true,
        },
      },
    },
  });

  return {
    ...user,
    fallAlerts,
  };
}

}
