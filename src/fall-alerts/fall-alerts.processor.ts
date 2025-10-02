// fall-alerts.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FallAlertsService } from './fall-alerts.service';
import { WhatsAppService } from 'src/whatsapp/whatsapp.service';
import { PrismaService } from 'src/prisma/prisma.service';
import { FallAlertsGateway } from './fall-alerts.gateway';

@Processor('fall-alerts')
export class FallAlertsProcessor extends WorkerHost {
  constructor(
    private readonly fallAlertsService: FallAlertsService,
    private readonly whatsappService: WhatsAppService,
    private readonly prismaService: PrismaService,
    private readonly gateway: FallAlertsGateway,
  ) {
    super();
  }

  async process(job: Job<any>) {
    console.log(`[BullMQ] Processando job: ${job.name}, ID: ${job.id}`);
    
    if (job.name === 'autoConfirm') {
      const { alertId } = job.data;
      console.log(`[BullMQ] Iniciando confirmação automática para alerta ${alertId}`);

      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
      });

      if (!alert) {
        console.log(`[BullMQ] Alerta ${alertId} não encontrado`);
        return;
      }
      
      if (alert.status !== 'PENDING' && alert.status !== 'VERIFYING') {
        console.log(`[BullMQ] Alerta ${alertId} já processado, status: ${alert.status}`);
        return;
      }

      try {
        await this.fallAlertsService.confirmAlert(alertId);
        console.log(`[BullMQ] Alerta ${alertId} confirmado automaticamente`);
      } catch (error) {
        console.error(`[BullMQ] Erro ao confirmar alerta ${alertId}:`, error);
      }
    }

    // 🆕 Job para pedir confirmação após 2 minutos
    if (job.name === 'requestConfirmation') {
      const { alertId, caregiverId } = job.data;
      console.log(`[BullMQ] Solicitando confirmação para alerta ${alertId}`);

      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
        include: { patient: true },
      });

      if (!alert || alert.status !== 'VERIFYING') {
        console.log(`[BullMQ] Alerta ${alertId} não está mais em verificação`);
        return;
      }

      const caregiver = await this.prismaService.emergencyContact.findFirst({
        where: { patientId: alert.patientId, priority: 1 },
      });

      if (caregiver) {
        
        const googleMapsLink = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;
        
        await this.whatsappService.enviarTexto(
          caregiver.phone,
          `⏰ *LEMBRETE DE VERIFICAÇÃO*\n\nPaciente: ${alert.patient.name}\nLocalização: ${googleMapsLink}\n\n⚠️ Você indicou que estava verificando. Por favor, confirme o status pelo aplicativo.`
        );
      }

      // Emite via WebSocket pedindo confirmação
      this.gateway.emitRequestConfirmation({
        id: alert.id,
        patientId: alert.patientId,
      });
    }
  }
}
