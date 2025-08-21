import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dtos/create-user.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async createUser(dto: CreateUserDto) {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException(`User with email ${email} already exists`);
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
    // Se ficar pesado, troque por selects específicos ou paginação
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
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        hasAccount: true,
        createdAt: true,
        devices: true,
        fallAlerts: true,
        contacts: true,
        patients: {
          select: {
            id: true,
            patient: true
          }
        }
      },
    });
  }
}
