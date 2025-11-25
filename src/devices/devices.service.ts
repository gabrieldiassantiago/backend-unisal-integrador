import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PairDeviceDto } from './dtos/pair-device.dto';
import { DeviceHeartbeatDto } from './dtos/device-heartbeat.dto';
import { existingDevicePair } from 'src/errors/existingDevicePair';
import * as bcrypt from 'bcrypt';
import { noFoundUser } from 'src/errors/noFoundUser';
import { Device, DeviceStatus } from '@src/types/device.type';
import { DeviceStatusGateway } from './device-status.gateway';

@Injectable()
export class DevicesService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly deviceStatusGateway: DeviceStatusGateway,
  ) { }

  async pairDevice(data: PairDeviceDto): Promise<Device> {
    const existingDevicePaired = await this.prismaService.device.findUnique({
      where: { deviceIdentifier: data.serial },
    });

    const patientExists = await this.prismaService.user.findUnique({
      where: { id: data.patientId },
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
        patientId: data.patientId,
        status: 'ACTIVE',
        registeredAt: new Date(),
      },
      create: {
        deviceIdentifier: data.serial,
        apiKeyHash,
        patientId: data.patientId,
        status: 'ACTIVE',
        registeredAt: new Date(),
      },
    });

    return {
      id: device.id,
      deviceIdentifier: device.deviceIdentifier,
      patientId: device.patientId,
      status: device.status as DeviceStatus,
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
      data: { status: 'INACTIVE' },
    });
  }

  /**
   * Processa heartbeat do ESP32
   * Atualiza status do dispositivo e emite via WebSocket
   */

  async processHeartbeat(data: DeviceHeartbeatDto) {
    // Busca o device pelo serial
    const device = await this.prismaService.device.findUnique({
      where: { deviceIdentifier: data.serial },
      include: { patient: true },
    });

    if (!device) {
      throw new Error(`Dispositivo ${data.serial} não encontrado.`);
    }


    const wasOffline = !device.isOnline;

    // Atualiza o device
    const updatedDevice = await this.prismaService.device.update({
      where: { id: device.id },
      data: {
        isOnline: true,
        lastHeartbeatAt: new Date(),
        lastSeenAt: new Date(),
        batteryLevel: data.batteryLevel,
        signalStrength: data.signalStrength,
        firmwareVersion: data.firmwareVersion || device.firmwareVersion,
        ipAddress: data.ipAddress,
      },
    });

    // Prepara dados para WebSocket
    const statusUpdate = {
      deviceId: updatedDevice.id,
      deviceIdentifier: updatedDevice.deviceIdentifier,
      patientId: updatedDevice.patientId!,
      isOnline: true,
      batteryLevel: updatedDevice.batteryLevel ?? undefined,
      signalStrength: updatedDevice.signalStrength ?? undefined,
      lastHeartbeatAt: updatedDevice.lastHeartbeatAt ?? undefined,
      status: updatedDevice.status,
    };

    // Se estava offline e voltou, emite evento específico
    if (wasOffline) {
      await this.deviceStatusGateway.emitDeviceOnline(statusUpdate);
    } else {
      // Apenas atualização de status normal
      await this.deviceStatusGateway.emitDeviceStatusUpdate(statusUpdate);
    }

    return {
      success: true,
      deviceId: updatedDevice.id,
      isOnline: updatedDevice.isOnline,
      message: 'Heartbeat recebido com sucesso',
    };
  }

  /**
   * Obtém status completo de um device
   */

  async getDeviceStatus(deviceId: string) {
    const device = await this.prismaService.device.findUnique({
      where: { id: deviceId },
      select: {
        id: true,
        deviceIdentifier: true,
        patientId: true,
        status: true,
        isOnline: true,
        batteryLevel: true,
        signalStrength: true,
        lastHeartbeatAt: true,
        lastSeenAt: true,
        firmwareVersion: true,
        registeredAt: true,
      },
    });

    if (!device) {
      throw new Error(`Dispositivo ${deviceId} não encontrado.`);
    }

    return device;
  }

  /**
   * Marca dispositivos como offline se não enviaram heartbeat
   * a mais de X minutos (executado periodicamente)
   */
  async checkOfflineDevices() {
    const OFFLINE_THRESHOLD_MINUTES = 5;
    const thresholdDate = new Date();
    thresholdDate.setMinutes(thresholdDate.getMinutes() - OFFLINE_THRESHOLD_MINUTES);

    // Busca devices que estão marcados como online mas não enviaram heartbeat
    const devicesGoingOffline = await this.prismaService.device.findMany({
      where: {
        isOnline: true,
        OR: [
          { lastHeartbeatAt: { lt: thresholdDate } },
          { lastHeartbeatAt: null },
        ],
      },
      select: {
        id: true,
        deviceIdentifier: true,
        patientId: true,
        lastHeartbeatAt: true,
        patient: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (devicesGoingOffline.length > 0) {
      // Marca como offline
      const deviceIds = devicesGoingOffline.map(d => d.id);

      await this.prismaService.device.updateMany({
        where: {
          id: { in: deviceIds },
        },
        data: {
          isOnline: false,
        },
      });

      // Emite eventos WebSocket para cada dispositivo
      for (const device of devicesGoingOffline) {
        if (device.patientId) {
          await this.deviceStatusGateway.emitDeviceOffline({
            deviceId: device.id,
            deviceIdentifier: device.deviceIdentifier,
            patientId: device.patientId,
          });
        }
      }
    }

    return {
      checked: new Date(),
      devicesMarkedOffline: devicesGoingOffline.length,
      offlineDeviceIds: devicesGoingOffline.map(d => d.id), // IDs para notificação
    };
  }

  /**
   *  Buscar todos os devices de um paciente com status completo
   */

  async getPatientDevices(patientId: string) {
    const devices = await this.prismaService.device.findMany({
      where: { patientId },
      select: {
        id: true,
        deviceIdentifier: true,
        patientId: true,
        status: true,
        isOnline: true,
        batteryLevel: true,
        signalStrength: true,
        lastHeartbeatAt: true,
        lastSeenAt: true,
        firmwareVersion: true,
        ipAddress: true,
        registeredAt: true,
      },
      orderBy: {
        registeredAt: 'desc',
      },
    });

    return devices.map(device => ({
      deviceId: device.id,
      deviceIdentifier: device.deviceIdentifier,
      patientId: device.patientId,
      isOnline: device.isOnline ?? false,
      batteryLevel: device.batteryLevel ?? undefined,
      signalStrength: device.signalStrength ?? undefined,
      lastHeartbeatAt: device.lastHeartbeatAt ?? undefined,
      status: device.status,
      firmwareVersion: device.firmwareVersion ?? undefined,
      ipAddress: device.ipAddress ?? undefined,
    }));
  }


}
