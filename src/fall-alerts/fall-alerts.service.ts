// src/fall-alerts/fall-alerts.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WhatsAppService } from 'src/whatsapp/whatsapp.service';
import { FallAlertsGateway } from './fall-alerts.gateway';
import { CreateFallAlertDto } from './dtos/create-fall-alert.dto';
import * as bcrypt from 'bcrypt';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { deviceNotExisting } from '@src/errors/deviceNoExist';
import { apiKeyInvalid } from '@src/errors/apiKeyInvalid';
import { alertNoExisting } from '@src/errors/alertNoExistint';

@Injectable()
export class FallAlertsService {
  constructor(
    @InjectQueue('fall-alerts') private alertsQueue: Queue,
    private readonly prismaService: PrismaService,
    private readonly whatsappService: WhatsAppService,
    private readonly gateway: FallAlertsGateway,
  ) {}

  // 🚨 Criar novo alerta
  async createAlert(data: CreateFallAlertDto) {
    // 1. Busca dispositivo
    const device = await this.prismaService.device.findUnique({
      where: { deviceIdentifier: data.serial },
    });
    if (!device) {
      throw new deviceNotExisting(data.serial);
    }

    // 2. Valida API key
    const isValidApiKey = await bcrypt.compare(data.apiKey, device.apiKeyHash);
    if (!isValidApiKey) {
      throw new apiKeyInvalid(data.apiKey);
    }

    // 3. Cria o alerta no banco
    const alert = await this.prismaService.fallAlert.create({
      data: {
        deviceId: device.id,
        patientId: device.patientId,
        latitude: data.latitude,
        longitude: data.longitude,
        createdAt: new Date(data.timestamp),
        status: 'PENDING',
      },
    });

    const payload = {
      id: alert.id,
      deviceId: alert.deviceId,
      patientId: alert.patientId,
      latitude: alert.latitude,
      longitude: alert.longitude,
      createdAt: alert.createdAt,
      status: alert.status,
    };

    // emite realtime no socket
    this.gateway.emitNewAlert(payload);

    // agenda auto confirm
    await this.alertsQueue.add(
      'autoConfirm',
      { alertId: alert.id },
      { delay: 5000 },
    );

    return payload;
  }

  // 📋 Buscar alertas de um paciente
  async getAlertsByPatient(patientId: string) {
    return this.prismaService.fallAlert.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ✅ Confirmar alerta (manda msg pra todos os contatos)
  async confirmAlert(alertId: string) {
    const alert = await this.prismaService.fallAlert.findUnique({
      where: { id: alertId },
    });
    if (!alert) {
      throw new alertNoExisting(alert);
    }

    const patient = await this.prismaService.user.findUnique({
      where: { id: alert.patientId },
    });
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado.');
    }

    const contatos = await this.prismaService.emergencyContact.findMany({
      where: { patientId: alert.patientId },
      select: { phone: true, name: true },
    });

    if (contatos.length === 0) {
      throw new BadRequestException('Nenhum contato de emergência encontrado para o paciente.');
    }

    // envia WhatsApp pra todos
    for (const contact of contatos) {
      try {
        await this.whatsappService.enviarTexto(
          contact.phone,
          `🚨 Alerta de queda confirmado para o paciente ${patient.name}. 
      Por favor, verifique o bem-estar dele.`,
        );
      } catch (err) {
        console.error(`Falha ao enviar WhatsApp para ${contact.name}:`, err);
      }
    }

    // atualiza status
    const updated = await this.prismaService.fallAlert.update({
      where: { id: alertId },
      data: { status: 'CONFIRMED' },
    });

    const payload = {
      id: updated.id,
      patientId: updated.patientId,
      status: updated.status,
    };

    // emite realtime
    this.gateway.emitConfirmed(payload);

    return payload;
  }
}
