import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FallAlertsService } from './fall-alerts.service';
@Processor('fall-alerts')
export class FallAlertsProcessor extends WorkerHost {
  constructor(private readonly fallAlertsService: FallAlertsService) {
    super();
  }

  async process(job: Job<any>) {
    console.log(`[BullMQ] Processando job: ${job.name}, ID: ${job.id}`);
    if (job.name === 'autoConfirm') {
      const { alertId } = job.data;
      console.log(`[BullMQ] Iniciando confirmação automática para alerta ${alertId}`);

      const alert = await this.fallAlertsService['prismaService'].fallAlert.findUnique({
        where: { id: alertId },
      });

      if (!alert) {
        console.log(`[BullMQ] Alerta ${alertId} não encontrado`);
        return;
      }
      if (alert.status !== 'PENDING') {
        console.log(`[BullMQ] Alerta ${alertId} não está PENDING, status atual: ${alert.status}`);
        return;
      }

      try {
        await this.fallAlertsService.confirmAlert(alertId);
        console.log(`[BullMQ] Alerta ${alertId} confirmado automaticamente`);
      } catch (error) {
        console.error(`[BullMQ] Erro ao confirmar alerta ${alertId}:`, error);
      }
    }
  }
}