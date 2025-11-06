// fall-alerts.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { FallAlertsService } from './fall-alerts.service';
import { PrismaService } from '@src/prisma/prisma.service';
import { FallAlertsGateway } from './fall-alerts.gateway';
import { TwilioService } from '@src/twilio/twilio.service';

@Processor('fall-alerts')
export class FallAlertsProcessor extends WorkerHost {
  constructor(
    @InjectQueue('fall-alerts') private alertsQueue: Queue,
    private readonly fallAlertsService: FallAlertsService,
    private readonly prismaService: PrismaService,
    private readonly gateway: FallAlertsGateway,
    private readonly twilioService: TwilioService,
  ) {
    super();
  }

  async process(job: Job<any>) {
    console.log(`\n========================================`);
    console.log(`[BullMQ] 🔄 Processando job: ${job.name}`);
    console.log(`[BullMQ] 📋 Job ID: ${job.id}`);
    console.log(`[BullMQ] 📊 Data:`, JSON.stringify(job.data, null, 2));
    console.log(`========================================\n`);
    
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
  console.log(`\n[BullMQ] 🔔 ================================`);
  console.log(`[BullMQ] 🔔 SOLICITANDO CONFIRMAÇÃO`);
  console.log(`[BullMQ] 🔔 Alerta: ${alertId}`);
  console.log(`[BullMQ] 🔔 Cuidador: ${caregiverId}`);
  console.log(`[BullMQ] 🔔 Timestamp: ${new Date().toISOString()}`);
  console.log(`[BullMQ] 🔔 ================================\n`);

  const alert = await this.prismaService.fallAlert.findUnique({
    where: { id: alertId },
    include: { patient: true },
  });

  if (!alert) {
    console.log(`[BullMQ] ⚠️ Alerta ${alertId} não encontrado. Cancelando job.`);
    return;
  }

  if (alert.status !== 'VERIFYING') {
    console.log(`[BullMQ] ⚠️ Alerta ${alertId} não está mais em verificação (status: ${alert.status}). Cancelando job.`);
    return;
  }

  console.log(`[BullMQ] ✅ Alerta ${alertId} está em verificação, enviando lembrete...`);

  //  VERIFICAÇÃO CRÍTICA: Quantos clientes estão conectados?
  const roomName = `patient_${alert.patientId}`;
  
  console.log(`\n[BullMQ] 🔍 ================================`);
  console.log(`[BullMQ] 🔍 VERIFICANDO SALA ANTES DE EMITIR`);
  console.log(`[BullMQ] 🔍 ================================`);
  
  // Tenta buscar os sockets conectados na sala
  try {
    const sockets = await this.gateway.server?.in(roomName).fetchSockets();
    const clientCount = sockets?.length ?? 0;
    
    console.log(`[BullMQ] 🔍 Sala: ${roomName}`);
    console.log(`[BullMQ] 🔍 Clientes conectados: ${clientCount}`);
    
    if (clientCount === 0) {
      console.log(`[BullMQ] ⚠️ ⚠️ ⚠️ CRÍTICO: NENHUM CLIENTE NA SALA!`);
      console.log(`[BullMQ] ⚠️ O evento NÃO será recebido pelo frontend!`);
      console.log(`[BullMQ] ⚠️ Verifique se o frontend está:`);
      console.log(`[BullMQ] ⚠️   1. Conectado ao WebSocket`);
      console.log(`[BullMQ] ⚠️   2. Fez join na sala patient_${alert.patientId}`);
      console.log(`[BullMQ] ⚠️   3. Está escutando o evento 'requestConfirmation'`);
    } else {
      console.log(`[BullMQ] ✅ Clientes na sala que receberão o evento:`);
      sockets!.forEach((s, index) => {
        console.log(`[BullMQ] ✅   ${index + 1}. Socket ID: ${s.id}`);
      });
    }
  } catch (error) {
    console.error(`[BullMQ] ❌ Erro ao verificar sala:`, error);
  }
  
  console.log(`[BullMQ] 🔍 ================================\n`);

  // Busca informações do cuidador
  const caregiver = await this.prismaService.emergencyContact.findFirst({
    where: { 
      id: caregiverId,
      patientId: alert.patientId 
    },
  });

   if (!caregiver) {
    console.log(`[BullMQ] ⚠️ Cuidador ${caregiverId} não encontrado. Buscando contato prioritário...`);
    const priorityCaregiver = await this.prismaService.emergencyContact.findFirst({
      where: { patientId: alert.patientId, priority: 1 },
    });
    
    if (priorityCaregiver) {
      console.log(`[BullMQ] ✅ Usando contato prioritário: ${priorityCaregiver.name}`);
    }
  }

  // Tenta enviar WhatsApp (pode falhar por limite)
  const contactToNotify = caregiver || await this.prismaService.emergencyContact.findFirst({
    where: { patientId: alert.patientId, priority: 1 },
  });

  if (contactToNotify) {
    const googleMapsLink = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;
    
    try {
      await this.twilioService.sendWhatsAppMessage(
        contactToNotify.phone,
        `⏰ *LEMBRETE DE VERIFICAÇÃO*\n\nPaciente: ${alert.patient.name}\nLocalização: ${googleMapsLink}\n\n⚠️ Você indicou que estava verificando. Por favor, confirme o status pelo aplicativo.`
      );
      console.log(`[BullMQ] ✅ WhatsApp enviado para ${contactToNotify.name}`);
    } catch (error) {
      console.error(`[BullMQ] ❌ Erro ao enviar WhatsApp (limite diário atingido):`, error.message);
    }
  }

  // 🚨 EMISSÃO DO EVENTO WEBSOCKET
  console.log(`\n[BullMQ] 📡 ================================`);
  console.log(`[BullMQ] 📡 EMITINDO VIA WEBSOCKET`);
  console.log(`[BullMQ] 📡 ================================`);
  
  const payload = {
    id: alert.id,
    patientId: alert.patientId,
    alertId: alert.id,
    message: 'Você indicou que estava verificando. Por favor, confirme o status do alerta.',
    timestamp: new Date().toISOString(),
  };
  
  console.log(`[BullMQ] 📊 Payload completo:`, JSON.stringify(payload, null, 2));
  
  // EMITE O EVENTO
  await this.gateway.emitRequestConfirmation(payload);
  
  console.log(`[BullMQ] ✅ Evento requestConfirmation emitido!`);
  console.log(`[BullMQ] 📡 ================================\n`);
  
  //  VERIFICAÇÃO PÓS-EMISSÃO
  console.log(`\n[BullMQ] 🔍 VERIFICAÇÃO PÓS-EMISSÃO`);
  try {
    const socketsAfter = await this.gateway.server?.in(roomName).fetchSockets();
    console.log(`[BullMQ] 🔍 Clientes ainda conectados: ${socketsAfter?.length ?? 0}`);
  } catch (error) {
    console.error(`[BullMQ] ❌ Erro na verificação pós-emissão:`, error);
  }
  console.log(`[BullMQ] 🔍 ================================\n`);
  
  console.log(`[BullMQ] ✅ Job requestConfirmation concluído!\n`);
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

      // Envia WhatsApp
      try {
        const message = `🚨 *ALERTA DE QUEDA*\n\nPaciente: ${patient.name}\n\n📍 Localização:\n${googleMapsLink}\n\nPor favor, verifique imediatamente!`;
        await this.twilioService.sendWhatsAppMessage(priorityContact.phone, message);
        console.log(`[BullMQ] ✅ WhatsApp enviado para ${priorityContact.name}`);
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
          const message = `⚠️ *ALERTA DE QUEDA - BACKUP*\n\nO contato prioritário não respondeu!\n\nPaciente: ${patient.name}\n📍 ${googleMapsLink}\n\nPor favor, verifique imediatamente!`;
          await this.twilioService.sendWhatsAppMessage(contact.phone, message);
          console.log(`[BullMQ] ✅ WhatsApp enviado para ${contact.name} (prioridade ${contact.priority})`);
        } catch (err) {
          console.error(`[BullMQ] ❌ Erro ao enviar WhatsApp para ${contact.name}:`, err.message);
        }
      }
    }
    
    //  Job para monitorar chamadas
    if (job.name === 'monitorCall') {
      const { alertId, contactId, patientName } = job.data;
      console.log(`[BullMQ] Monitorando chamada para alerta ${alertId}, contato ${contactId}`);

      // Aqui você pode adicionar lógica de monitoramento de chamadas se necessário
      console.log(`[BullMQ] ✅ Monitoramento de chamada concluído para alerta ${alertId}`);
    }
  }
}
