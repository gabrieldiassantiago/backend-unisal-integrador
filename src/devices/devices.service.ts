import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PairDeviceDto } from './dtos/pair-device.dto';
import { existingDevicePair } from 'src/errors/existingDevicePair';
import * as bcrypt from 'bcrypt';
import { noFoundUser } from 'src/errors/noFoundUser';

@Injectable()
export class DevicesService {
    constructor(private readonly prismaService: PrismaService){}

    async pairDevice(data: PairDeviceDto) {
        const existingDevicePaired = await this.prismaService.device.findUnique({
            where: {
                deviceIdentifier: data.serial
            }
        })

        const userExists = await this.prismaService.user.findUnique({
            where: {
                id: data.userId
            }
        })

        if (!userExists) {
            throw new noFoundUser(`Usuário com ID ${data.userId} não encontrado.`);
        }

        if (existingDevicePaired) {
            throw new existingDevicePair(data.serial);
        }


        const apiKeyHash = await bcrypt.hash(data.apiKey, 6);

        const device = await this.prismaService.device.upsert({
            where: {
                deviceIdentifier: data.serial
            },
            update: {
                apiKeyHash,
                userId: data.userId,
                isActive: true,
                registeredAt: new Date(),
            },
            create: {
                deviceIdentifier: data.serial,
                apiKeyHash,
                userId: data.userId,
                isActive: true,
                registeredAt: new Date(),
            }
        })
        return {
        id: device.id,
        deviceIdentifier: device.deviceIdentifier,
        userId: device.userId,
        isActive: device.isActive,
        registeredAt: device.registeredAt,
        
        }
    }

    async listDevicesByUser(userId: string) {
        return this.prismaService.device.findMany({
            where: {
                userId: userId,
            },
            select: {
                id: true,
                deviceIdentifier: true,
                userId: true,
                isActive: true,
                registeredAt: true,
            }
        })
    }

    async deactivateDevice(deviceId: string, userId) {
        const device = await this.prismaService.device.findUnique({
            where: {
                id: userId
            }
        })

        if (!device || device.userId !== userId) {
            throw new Error(`Dispositivo com ID ${deviceId} não encontrado ou não pertence ao usuário com ID ${userId}.`);
        }

        return this.prismaService.device.update({
            where: {
                id: deviceId
            },
            data: {
                isActive: false,
            }
        })
    }
    
}
