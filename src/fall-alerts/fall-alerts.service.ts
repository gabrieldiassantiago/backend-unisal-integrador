// fall-alerts.service.ts
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
import { TwilioService } from '@src/twilio/twilio.service';

@Injectable()
export class FallAlertsService {
  constructor(
    @InjectQueue('fall-alerts') private alertsQueue: Queue,
    private readonly prismaService: PrismaService,
    private readonly whatsappService: WhatsAppService,
    private readonly gateway: FallAlertsGateway,
    private readonly twilioService: TwilioService,
  ) {}

  // 🚨 Criar novo alerta
  async createAlert(data: CreateFallAlertDto) {
    const device = await this.prismaService.device.findUnique({
      where: { deviceIdentifier: data.serial },
    });
    if (!device) {
      throw new deviceNotExisting(data.serial);
    }

    const isValidApiKey = await bcrypt.compare(data.apiKey, device.apiKeyHash);
    if (!isValidApiKey) {
      throw new apiKeyInvalid(data.apiKey);
    }

    const alert = await this.prismaService.fallAlert.create({
      data: {
        deviceId: device.id,
        patientId: device.patientId,
        latitude: data.latitude,
        longitude: data.longitude,
        createdAt: new Date(),
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

    // Emite para WebSocket
    this.gateway.emitNewAlert(payload);

    // Busca cuidador prioridade 1 e envia WhatsApp
    const primaryCaregiver = await this.prismaService.emergencyContact.findFirst({
      where: { patientId: device.patientId, priority: 1 },
    });

    if (primaryCaregiver) {
      const patient = await this.prismaService.user.findUnique({
        where: { id: device.patientId },
      });

      const googleMapsLink = `https://www.google.com/maps?q=${data.latitude},${data.longitude}`;
      
      await this.whatsappService.enviarTexto(
        primaryCaregiver.phone,
        `🚨 *ALERTA DE QUEDA DETECTADO*\n\nPaciente: ${patient?.name}\nLocalização: ${googleMapsLink}\n\n⚠️ Por favor, responda pelo aplicativo:\n- "Falso Alerta"\n- "Estou Indo Verificar"`
      );
    }

    // Agenda confirmação automática para 5 minutos
    await this.alertsQueue.add(
      'autoConfirm',
      { alertId: alert.id },
      { delay: 300000 }, // 5 minutos
    );

    return payload;
  }

  // 🆕 Marcar como falso alerta
  async markFalseAlarm(alertId: string, caregiverId: string) {
    const alert = await this.prismaService.fallAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) throw new alertNoExisting(alertId);
    if (alert.status !== 'PENDING') {
      throw new BadRequestException('Alerta já foi processado');
    }

    const patient = await this.prismaService.user.findUnique({
      where: { id: alert.patientId },
    });

    const caregiver = await this.prismaService.user.findUnique({
      where: { id: caregiverId },
    });

    // Atualiza status
    const updated = await this.prismaService.fallAlert.update({
      where: { id: alertId },
      data: { 
        status: 'FALSE_ALARM',
        respondedBy: caregiverId,
        respondedAt: new Date(),
      },
    });

    // Notifica todos os cuidadores
    const allCaregivers = await this.prismaService.emergencyContact.findMany({
      where: { patientId: alert.patientId },
    });

    for (const contact of allCaregivers) {
      await this.whatsappService.enviarTexto(
        contact.phone,
        `✅ *FALSO ALERTA*\n\nPaciente: ${patient?.name}\nAlerta marcado como falso por ${caregiver?.name}\n\nNenhuma ação necessária.`
      );
    }

    // Emite via WebSocket
    this.gateway.emitAlertStatusChange({
      id: updated.id,
      patientId: updated.patientId,
      status: updated.status,
      respondedBy: caregiverId,
    });

    // Cancela job de confirmação automática
    const jobs = await this.alertsQueue.getJobs(['delayed']);
    for (const job of jobs) {
      if (job.data.alertId === alertId) {
        await job.remove();
      }
    }

    return updated;
  }

  // 🆕 Marcar como "estou verificando"
  async markVerifying(alertId: string, caregiverId: string) {
    const alert = await this.prismaService.fallAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) throw new alertNoExisting(alertId);
    if (alert.status !== 'PENDING') {
      throw new BadRequestException('Alerta já foi processado');
    }

    const caregiver = await this.prismaService.user.findUnique({
      where: { id: caregiverId },
    });

    // Atualiza status
    const verificationDeadline = new Date(Date.now() + 120000); // 2 minutos
    const updated = await this.prismaService.fallAlert.update({
      where: { id: alertId },
      data: { 
        status: 'VERIFYING',
        respondedBy: caregiverId,
        respondedAt: new Date(),
        verificationDeadline,
      },
    });

    // Emite via WebSocket
    this.gateway.emitAlertStatusChange({
      id: updated.id,
      patientId: updated.patientId,
      status: updated.status,
      respondedBy: caregiverId,
      verificationDeadline,
    });

    // Agenda job para cobrar confirmação em 2 minutos
    await this.alertsQueue.add(
      'requestConfirmation',
      { alertId: alert.id, caregiverId },
      { delay: 120000 }, // 2 minutos
    );

    return updated;
  }

  // 🆕 Confirmar após verificação
  async confirmAfterVerification(alertId: string, caregiverId: string) {
    const alert = await this.prismaService.fallAlert.findUnique({
      where: { id: alertId },
    });

    if (!alert) throw new alertNoExisting(alertId);
    if (alert.status !== 'VERIFYING') {
      throw new BadRequestException('Alerta não está em verificação');
    }

    return this.confirmAlert(alertId);
  }

  // ✅ Confirmar alerta (manda msg pra todos os contatos)
  async confirmAlert(alertId: string) {
    const alert = await this.prismaService.fallAlert.findUnique({
      where: { id: alertId },
    });
    if (!alert) throw new alertNoExisting(alert);

    const patient = await this.prismaService.user.findUnique({
      where: { id: alert.patientId },
    });
    
    if (!patient) {
      throw new NotFoundException('Paciente não encontrado.');
    }

    const contatos = await this.prismaService.emergencyContact.findMany({
      where: { patientId: alert.patientId },
      select: { phone: true, name: true, priority: true },
      orderBy: { priority: 'asc' },
    });

    if (contatos.length === 0) {
      throw new BadRequestException('Nenhum contato de emergência encontrado para o paciente.');
    }

    const googleMapsLink = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;

    // Envia WhatsApp para todos os contatos
    for (const contact of contatos) {
      try {
        await this.whatsappService.enviarTexto(
          contact.phone,
          `🚨 *ALERTA DE QUEDA CONFIRMADO*\n\nPaciente: ${patient.name}\nLocalização: ${googleMapsLink}\n\n⚠️ Por favor, verifique o bem-estar do paciente imediatamente.`,
        );
      } catch (err) {
        console.error(`Falha ao enviar WhatsApp para ${contact.name}:`, err);
      }
    }

    // Lógica de ligação com prioridade
    let callAnswered = false;
    for (const contact of contatos) {
      if (callAnswered) break;

      try {
        console.log(`Tentando ligar para ${contact.name} (prioridade ${contact.priority})...`);
        const call = await this.twilioService.makeFallAlertCall(contact.phone, patient.name);

        await new Promise(resolve => setTimeout(resolve, 20000));

        const callRecord = await this.twilioService.client.calls(call.sid).fetch();

        if (callRecord.status === 'completed') {
          console.log(`Chamada atendida por ${contact.name}.`);
          callAnswered = true;
        } else {
          console.log(`Chamada para ${contact.name} não atendida (status: ${callRecord.status}).`);
        }
      } catch (err) {
        console.error(`Falha ao ligar para ${contact.name}:`, err);
      }
    }

    if (!callAnswered) {
      console.log('Nenhum contato de emergência atendeu à chamada.');
    }

    // Atualiza status
    const updated = await this.prismaService.fallAlert.update({
      where: { id: alertId },
      data: { status: 'CONFIRMED' },
    });

    const payload = {
      id: updated.id,
      patientId: updated.patientId,
      status: updated.status,
    };

    // Emite realtime
    this.gateway.emitConfirmed(payload);

    return payload;
  }

  async getAlertsByPatient(patientId: string) {
    return this.prismaService.fallAlert.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
