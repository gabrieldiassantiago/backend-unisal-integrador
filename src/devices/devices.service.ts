import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PairDeviceDto } from './dtos/pair-device.dto';
import { existingDevicePair } from 'src/errors/existingDevicePair';
import * as bcrypt from 'bcrypt';
import { noFoundUser } from 'src/errors/noFoundUser';

@Injectable()
export class DevicesService {
  constructor(private readonly prismaService: PrismaService) {}

  async pairDevice(data: PairDeviceDto) {
    const existingDevicePaired = await this.prismaService.device.findUnique({
      where: { deviceIdentifier: data.serial },
    });

    const patientExists = await this.prismaService.user.findUnique({
      where: { id: data.patientId }, // esse user precisa ser role=PATIENT
    });

    if (!patientExists) {
      throw new noFoundUser(`Paciente com ID ${data.patientId} não encontrado.`);
    }

    if (existingDevicePaired) {
      throw new existingDevicePair(data.serial);
    }

    const apiKeyHash = await bcrypt.hash(data.apiKey, 6);

    const device = await this.prismaService.device.upsert({
      where: { deviceIdentifier: data.serial },
      update: {
        apiKeyHash,
        patientId: data.patientId,     // 👈 agora é patientId
        status: 'ACTIVE',           // 👈 no lugar do isActive
        registeredAt: new Date(),
      },
      create: {
        deviceIdentifier: data.serial,
        apiKeyHash,
        patientId: data.patientId,     // 👈 agora é patientId
        status: 'ACTIVE',
        registeredAt: new Date(),
      },
    });

    return {
      id: device.id,
      deviceIdentifier: device.deviceIdentifier,
      patientId: device.patientId, // 👈 devolve patientId
      status: device.status,       // 👈 devolve status
      registeredAt: device.registeredAt,
    };
  }

  async listDevicesByUser(patientId: string) {
    return this.prismaService.device.findMany({
      where: { patientId },
      select: {
        id: true,
        deviceIdentifier: true,
        patientId: true,
        status: true,
        registeredAt: true,
      },
    });
  }

  async deactivateDevice(deviceId: string, patientId: string) {
    const device = await this.prismaService.device.findUnique({
      where: { id: deviceId },
    });

    if (!device || device.patientId !== patientId) {
      throw new Error(
        `Dispositivo ${deviceId} não encontrado ou não pertence ao paciente ${patientId}.`,
      );
    }

    return this.prismaService.device.update({
      where: { id: deviceId },
      data: { status: 'INACTIVE' }, // 👈 troca isActive por status
    });
  }
}
