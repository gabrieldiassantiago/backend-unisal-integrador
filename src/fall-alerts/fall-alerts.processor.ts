import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { FallAlertsService } from './fall-alerts.service';

@Processor('fall-alerts')

export class FallAlertsProcessor extends WorkerHost {

  constructor(private readonly fallAlertsService: FallAlertsService) {
    super();
  }

  async process(job: Job<any>) {
    
    if (job.name === 'autoConfirm') {

      const { alertId } = job.data;

      // busca no banco se já foi confirmado pelo paciente
      const alert = await this.fallAlertsService['prismaService'].fallAlert.findUnique({
        where: { id: alertId },
      });

      if (!alert || alert.status !== 'PENDING') {
        return; // já confirmado ou não existe
      }

      // confirma automaticamente
      await this.fallAlertsService.confirmAlert(alertId);
      console.log(`[BullMQ] Alerta ${alertId} confirmado automaticamente`);
    }
  }
}
