import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { ExistingError } from 'src/errors/existingUserError';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
    constructor(private readonly prismaService: PrismaService) {}

    async createUser(createUserDto: CreateUserDto) {

        const existingUser = await this.prismaService.user.findUnique({
            where: {
                email: createUserDto.email,
            },
        })
        
        if (existingUser) {
            throw new ExistingError(createUserDto.email);
        }

        const hashedPassword = await bcrypt.hash(createUserDto.password, 6);

        const user = await this.prismaService.user.create({
            data: {
                ...createUserDto,
                password: hashedPassword,
                hasAccount: true,
            }
        })
        return {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            hasAccount: user.hasAccount,
            createdAt: user.createdAt,
        };
    }


    async getAllUsers() {
        return this.prismaService.user.findMany({
            include: {
                devices: true,
                fallAlerts: true,
                contacts: true,
            }
        });
    }

    async getUserById(id: string) {
        return this.prismaService.user.findUnique({
            where: {
                id,
            },
            include: {
                devices: true,
                fallAlerts: true,
                contacts: true,
            }
        });
    }
}
