import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FallAlertsService } from './fall-alerts.service';
import { PrismaService } from '@src/prisma/prisma.service';
import { FallAlertsGateway } from './fall-alerts.gateway';
import { MessagingService } from '@src/messaging/messaging.service';

@Processor('fall-alerts')
export class FallAlertsProcessor extends WorkerHost {
  constructor(
    @InjectQueue('fall-alerts') private alertsQueue: Queue,
    private readonly fallAlertsService: FallAlertsService,
    private readonly prismaService: PrismaService,
    private readonly gateway: FallAlertsGateway,
    private readonly messagingService: MessagingService,
  ) {
    super();
  }

  async process(job: Job<any>) {
    console.log(`\n========================================`);
    console.log(`[BullMQ] 🔄 Processando job: ${job.name}`);
    console.log(`[BullMQ] 📋 Job ID: ${job.id}`);

    if (job.name === 'emitWebSocket') {
      const { event, payload } = job.data;
      if (event === 'newAlert') this.gateway.emitNewAlert(payload);
      else if (event === 'alertStatusChange') this.gateway.emitAlertStatusChange(payload);
      else if (event === 'requestConfirmation') this.gateway.emitRequestConfirmation(payload);
      return;
    }

    if (job.name === 'autoConfirm') {
      const { alertId } = job.data;
      const alert = await this.prismaService.fallAlert.findUnique({ where: { id: alertId } });
      if (!alert || (alert.status !== 'PENDING' && alert.status !== 'VERIFYING')) return;
      await this.fallAlertsService.confirmAlert(alertId);
    }

    if (job.name === 'requestConfirmation') {
      const { alertId, caregiverId, respondingPhone } = job.data; // <--- Lendo respondingPhone

      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
        include: { patient: true },
      });

      if (!alert || alert.status !== 'VERIFYING') return;

      const roomName = `patient_${alert.patientId}`;
      const payload = {
        id: alert.id,
        patientId: alert.patientId,
        alertId: alert.id,
        message: 'Você indicou que estava verificando. Por favor, confirme o status do alerta.',
        timestamp: new Date().toISOString(),
      };
      this.gateway.emitRequestConfirmation(payload);

      const googleMapsLink = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;

      let targetPhone = respondingPhone;
      let targetName = 'Cuidador';

      // 1. Prioriza o User se existir
      if (caregiverId) {
        const user = await this.prismaService.user.findUnique({
          where: { id: caregiverId },
          select: { id: true, name: true, phone: true },
        });
        if (user) {
          targetName = user.name;
          if (!targetPhone) targetPhone = user.phone;
        }
      }

      // 2. Tenta achar nome pelo telefone se for contato de emergência
      if (targetPhone && targetName === 'Cuidador') {
        const cleanPhone = targetPhone.replace(/\D/g, '').slice(-9);
        const contact = await this.prismaService.emergencyContact.findFirst({
          where: { patientId: alert.patientId, phone: { contains: cleanPhone } }
        });
        if (contact) targetName = contact.name;
      }

      if (!targetPhone) {
        const priorityContact = await this.prismaService.emergencyContact.findFirst({
          where: { patientId: alert.patientId, priority: 1 },
        });
        if (priorityContact) {
          targetPhone = priorityContact.phone;
          targetName = priorityContact.name;
        }
      }

      if (targetPhone) {
        try {
          await this.messagingService.sendVerificationReminderWithButtons({
            to: targetPhone,
            alertId: alert.id,
            patientName: alert.patient.name,
            location: googleMapsLink,
            contactName: targetName,
          });
          console.log(`[BullMQ] ✅ Lembrete enviado para ${targetName} (${targetPhone})`);
        } catch (err) {
          console.error(`[BullMQ] ❌ Erro envio:`, err);
        }
      }
    }

    if (job.name === 'processInitialAlert') {
      const { alertId, patientId, latitude, longitude } = job.data;
      const patient = await this.prismaService.user.findUnique({ where: { id: patientId } });
      const priorityContact = await this.prismaService.emergencyContact.findFirst({ where: { patientId, priority: 1 } });

      if (patient && priorityContact) {
        const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
        await this.messagingService.sendFallAlertWithButtons({
          to: priorityContact.phone,
          alertId,
          patientName: patient.name,
          location: googleMapsLink,
          contactName: priorityContact.name,
          priority: 1,
        });

        await this.alertsQueue.add(
          'monitorCall',
          { alertId, contactId: priorityContact.id, patientName: patient.name },
          { delay: 5000 }
        );
      }
    }

    if (job.name === 'notifySecondaryContacts') {
      const { alertId, patientId, latitude, longitude } = job.data;
      const alert = await this.prismaService.fallAlert.findUnique({ where: { id: alertId } });

      if (!alert || alert.status !== 'PENDING') return;

      const patient = await this.prismaService.user.findUnique({ where: { id: patientId } });
      const secondaryContacts = await this.prismaService.emergencyContact.findMany({
        where: { patientId, priority: { gt: 1 } },
        orderBy: { priority: 'asc' }
      });

      const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

      for (const contact of secondaryContacts) {
        await this.messagingService.sendFallAlertWithButtons({
          to: contact.phone,
          alertId,
          patientName: patient.name,
          location: googleMapsLink,
          contactName: contact.name,
          priority: contact.priority,
        });
      }
    }
  }
}