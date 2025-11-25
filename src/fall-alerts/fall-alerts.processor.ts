// fall-alerts.processor.ts
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
    console.log(`[BullMQ] 📊 Data:`, JSON.stringify(job.data, null, 2));
    console.log(`========================================\n`);

    //  Emit WebSocket
    if (job.name === 'emitWebSocket') {
      const { event, payload } = job.data;
      console.log(`[BullMQ] 🌐 Emitindo WebSocket: ${event}`, payload);

      if (event === 'newAlert') {
        this.gateway.emitNewAlert(payload);
      } else if (event === 'alertStatusChange') {
        this.gateway.emitAlertStatusChange(payload);
      } else if (event === 'requestConfirmation') {
        this.gateway.emitRequestConfirmation(payload);
      }

      console.log(`[BullMQ] ✅ WebSocket emitido com sucesso!`);
      return;
    }

    if (job.name === 'autoConfirm') {
      const { alertId } = job.data;
      console.log(`[BullMQ] Iniciando confirmação automática para alerta ${alertId}`);

      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
      });

      if (!alert) {
        console.log(`[BullMQ] ⚠️ Alerta ${alertId} não encontrado. Cancelando job.`);
        return;
      }

      // Só prossegue com a confirmação automática se o alerta ainda estiver pendente ou em verificação
      if (alert.status !== 'PENDING' && alert.status !== 'VERIFYING') {
        console.log(`[BullMQ] ⚠️ Alerta ${alertId} já foi processado (status: ${alert.status}). Cancelando job.`);
        return;
      }

      try {
        console.log(`[BullMQ] ✅ Confirmando automaticamente alerta ${alertId}...`);
        await this.fallAlertsService.confirmAlert(alertId);
        console.log(`[BullMQ] ✅ Alerta ${alertId} confirmado automaticamente com sucesso!`);
      } catch (error) {
        console.error(`[BullMQ] ❌ Erro ao confirmar automaticamente alerta ${alertId}:`, error);
        throw error;
      }
    }

    if (job.name === 'requestConfirmation') {
      const { alertId, caregiverId } = job.data;
      console.log(`\n[BullMQ] \ud83d\udd14 ================================`);
      console.log(`[BullMQ] \ud83d\udd14 requestConfirmation job iniciado`);
      console.log(`[BullMQ] \ud83d\udd14 alertId: ${alertId}`);
      console.log(`[BullMQ] \ud83d\udd14 responderUserId: ${caregiverId}`);
      console.log(`[BullMQ] \ud83d\udd14 Timestamp: ${new Date().toISOString()}`);
      console.log(`[BullMQ] \ud83d\udd14 ================================\n`);

      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
        include: { patient: true },
      });

      if (!alert) {
        console.log(`[BullMQ] \u26a0\ufe0f Alerta ${alertId} nao encontrado. Cancelando requestConfirmation.`);
        return;
      }

      // Somente processa se estiver em VERIFYING (quem marcou "estou verificando")
      if (alert.status !== 'VERIFYING') {
        console.log(`[BullMQ] \u26a0\ufe0f Alerta ${alertId} status atual é '${alert.status}'. Ignorando requestConfirmation.`);
        return;
      }

      // Emite evento WebSocket para quem estiver conectado na sala do paciente
      const roomName = `patient_${alert.patientId}`;
      const payload = {
        id: alert.id,
        patientId: alert.patientId,
        alertId: alert.id,
        message: 'Você indicou que estava verificando. Por favor, confirme o status do alerta.',
        timestamp: new Date().toISOString(),
      };

      try {
        await this.gateway.emitRequestConfirmation(payload);
        console.log(`[BullMQ] \u2705 Evento requestConfirmation emitido via WebSocket para sala ${roomName}`);
      } catch (emitErr) {
        console.error(`[BullMQ] \u274c Erro ao emitir evento requestConfirmation:`, emitErr);
      }

      // Log de clientes conectados (opcional, útil para debug)
      try {
        const sockets = await this.gateway.server?.in(roomName).fetchSockets();
        console.log(`[BullMQ] \ud83d\udd0d Clientes conectados na sala ${roomName}: ${sockets?.length ?? 0}`);
      } catch (err) {
        console.error(`[BullMQ] \u274c Erro ao verificar sockets na sala ${roomName}:`, err);
      }

      // Preparar link de localização
      const googleMapsLink = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;

      // Buscar o USUÁRIO (cuidador ou familiar) que indicou que estava verificando
      const respondingUser = await this.prismaService.user.findUnique({
        where: { id: caregiverId },
        select: { id: true, name: true, phone: true, role: true },
      });

      // Função auxiliar para enviar lembrete via WhatsApp/Infobip com botões
      const sendReminderToPhone = async (phone: string, name: string) => {
        try {
          await this.messagingService.sendVerificationReminderWithButtons({
            to: phone,
            alertId: alert.id,
            patientName: alert.patient.name,
            location: googleMapsLink,
            contactName: name,
          });
          console.log(`[BullMQ] \u2705 Lembrete enviado para ${name} (${phone})`);
        } catch (err) {
          console.error(`[BullMQ] \u274c Erro ao enviar lembrete para ${name} (${phone}):`, err.message ?? err);
        }
      };

      // Primeiro: tentar enviar para o telefone do usuário que respondeu
      if (respondingUser && respondingUser.phone) {
        console.log(`[BullMQ] \ud83d\udc64 Respondente encontrado: ${respondingUser.name} (${respondingUser.role}) - enviando para user.phone`);
        await sendReminderToPhone(respondingUser.phone, respondingUser.name);
      } else {
        // Se usuário não existir ou não tiver telefone, fallback para contato de emergência prioritário
        console.log(`[BullMQ] \u26a0\ufe0f Respondente sem telefone cadastrado ou não encontrado. Procurando contato prioritário do paciente.`);
        const priorityContact = await this.prismaService.emergencyContact.findFirst({
          where: { patientId: alert.patientId, priority: 1 },
        });

        if (priorityContact) {
          console.log(`[BullMQ] \ud83d\udce4 Usando contato prioritário: ${priorityContact.name} (${priorityContact.phone})`);
          await sendReminderToPhone(priorityContact.phone, priorityContact.name);
        } else {
          console.log(`[BullMQ] \u26a0\ufe0f Nenhum contato prioritário encontrado para paciente ${alert.patientId}. Não foi possível enviar lembrete.`);
        }
      }

      console.log(`[BullMQ] \ud83d\udd0d requestConfirmation job concluído para alertId ${alertId}\n`);
    }



    //  Job para processar alerta inicial (WhatsApp + Chamada para contato prioritário)
    if (job.name === 'processInitialAlert') {
      const { alertId, patientId, latitude, longitude } = job.data;
      console.log(`[BullMQ] Processando alerta inicial ${alertId} para paciente ${patientId}`);

      const patient = await this.prismaService.user.findUnique({
        where: { id: patientId },
      });

      if (!patient) {
        console.log(`[BullMQ] ⚠️ Paciente ${patientId} não encontrado.`);
        return;
      }

      const priorityContact = await this.prismaService.emergencyContact.findFirst({
        where: { patientId, priority: 1 },
      });

      if (!priorityContact) {
        console.log(`[BullMQ] ⚠️ Nenhum contato prioritário encontrado para o paciente ${patientId}.`);
        return;
      }

      const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

      try {
        console.log(`[BullMQ]   Enviando WhatsApp COM BOTÕES para ${priorityContact.name}...`);

        await this.messagingService.sendFallAlertWithButtons({
          to: priorityContact.phone,
          alertId,
          patientName: patient.name,
          location: googleMapsLink,
          contactName: priorityContact.name,
          priority: 1,
        });

        console.log(`[BullMQ] ✅ WhatsApp com BOTÕES enviado para ${priorityContact.name}`);
      } catch (err) {
        console.error(`[BullMQ] ❌ Erro ao enviar WhatsApp:`, err.message);
      }

      // Agenda job para monitorar chamada
      await this.alertsQueue.add(
        'monitorCall',
        { alertId, contactId: priorityContact.id, patientName: patient.name },
        { delay: 5000 } // 5 segundos
      );
    }

    //  Job para notificar contatos secundários após timeout do contato prioritário
    if (job.name === 'notifySecondaryContacts') {
      const { alertId, patientId, latitude, longitude } = job.data;
      console.log(`[BullMQ] Notificando contatos secundários para alerta ${alertId}`);

      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
      });

      // Se o alerta já foi resolvido, não notifica
      if (!alert || alert.status !== 'PENDING') {
        console.log(`[BullMQ] ⚠️ Alerta ${alertId} não está mais pendente. Cancelando notificação de contatos secundários.`);
        return;
      }

      const patient = await this.prismaService.user.findUnique({
        where: { id: patientId },
      });

      const secondaryContacts = await this.prismaService.emergencyContact.findMany({
        where: {
          patientId,
          priority: { gt: 1 } // Todos exceto prioridade 1
        },
        orderBy: { priority: 'asc' }
      });

      if (secondaryContacts.length === 0) {
        console.log(`[BullMQ] ⚠️ Nenhum contato secundário encontrado.`);
        return;
      }

      const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

      for (const contact of secondaryContacts) {
        try {
          console.log(`[BullMQ] 📤 Enviando WhatsApp COM BOTÕES para ${contact.name} (backup)...`);

          await this.messagingService.sendFallAlertWithButtons({
            to: contact.phone,
            alertId,
            patientName: patient.name,
            location: googleMapsLink,
            contactName: contact.name,
            priority: contact.priority,
          });

          console.log(`[BullMQ] ✅ WhatsApp com BOTÕES enviado para ${contact.name} (prioridade ${contact.priority})`);
        } catch (err) {
          console.error(`[BullMQ] ❌ Erro ao enviar WhatsApp para ${contact.name}:`, err.message);
        }
      }
    }
  }
}
