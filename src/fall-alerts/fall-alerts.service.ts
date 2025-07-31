// src/fall-alerts/fall-alerts.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { WhatsAppService } from 'src/whatsapp/whatsapp.service';
import { FallAlertsGateway } from './fall-alerts.gateway';
import { CreateFallAlertDto } from './dtos/create-fall-alert.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class FallAlertsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly whatsappService: WhatsAppService,
    private readonly gateway: FallAlertsGateway,
  ) {}

  /**  
   * Recebe dados do hardware, valida e cria um novo alerta de queda  
   * Emite evento `newAlert` via WebSocket para o paciente correspondente.  
   */
  async createAlert(data: CreateFallAlertDto) {
    // 1. Busca dispositivo pelo serial
    const device = await this.prismaService.device.findUnique({
      where: { deviceIdentifier: data.serial },
    });
    if (!device) {
      throw new NotFoundException(`Dispositivo com serial ${data.serial} não encontrado.`);
    }

    // 2. Valida API key
    const isValidApiKey = await bcrypt.compare(data.apiKey, device.apiKeyHash);
    if (!isValidApiKey) {
      throw new BadRequestException('Chave de API inválida.');
    }

    // 3. Cria o alerta no banco
    const alert = await this.prismaService.fallAlert.create({
      data: {
        deviceId: device.id,
        patientId: device.userId,
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

    // 4. Emite em tempo real para os clientes WebSocket
    this.gateway.emitNewAlert(payload);

    return payload;
  }

  async getAlertsByPatient(patientId: string) {
    return this.prismaService.fallAlert.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**  
   * Marca o alerta como confirmado, envia WhatsApp aos contatos de emergência  
   * e emite evento `alertConfirmed` via WebSocket.  
   */
  async confirmAlert(alertId: string) {
    // 1. Busca alerta
    const alert = await this.prismaService.fallAlert.findUnique({
      where: { id: alertId },
    });
    if (!alert) {
      throw new NotFoundException('Alerta não encontrado.');
    }

    // 2. Busca paciente
    const patient = await this.prismaService.user.findUnique({
      where: { id: alert.patientId },
    });
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado.');
    }

    // 3. Busca contatos de emergência
    const contatos = await this.prismaService.emergencyContact.findMany({
      where: { patientId: alert.patientId },
      select: { phone: true, name: true },
    });
    if (contatos.length === 0) {
      throw new BadRequestException('Nenhum contato de emergência encontrado para o paciente.');
    }

    // 4. Envia mensagem via WhatsApp
    for (const contact of contatos) {
      try {
        await this.whatsappService.enviarTexto(
          contact.phone,
          `Alerta de queda confirmado para o paciente ${patient.name}. Por favor, verifique o bem-estar dele.`,
        );
      } catch (err) {
        console.error(`Falha ao enviar WhatsApp para ${contact.name}:`, err);
      }
    }

    // 5. Atualiza status no banco
    const updated = await this.prismaService.fallAlert.update({
      where: { id: alertId },
      data: { status: 'CONFIRMED' },
    });

    const payload = {
      id: updated.id,
      patientId: updated.patientId,
      status: updated.status,
    };

    // 6. Emite confirmação em tempo real
    this.gateway.emitConfirmed(payload);

    return payload;
  }
}
