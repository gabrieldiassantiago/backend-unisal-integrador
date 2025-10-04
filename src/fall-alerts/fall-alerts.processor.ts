// fall-alerts.processor.ts
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { FallAlertsService } from './fall-alerts.service';
import { PrismaService } from 'src/prisma/prisma.service';
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
      
      // Só prossegue com a confirmação automática se o alerta ainda estiver pendente ou em verificação
      // Se foi resolvido, cancelado ou marcado como falso alarme, não faz nada
      if (alert.status !== 'PENDING' && alert.status !== 'VERIFYING') {
        console.log(`[BullMQ] Alerta ${alertId} já processado (${alert.status}), não precisa de confirmação automática`);
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
        
        await this.twilioService.sendWhatsAppMessage(
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
    
    // 🆕 Job para notificar contatos secundários após timeout do contato prioritário
    if (job.name === 'notifySecondaryContacts') {
      const { alertId, patientId, latitude, longitude } = job.data;
      console.log(`[BullMQ] Verificando se é necessário notificar contatos secundários para alerta ${alertId}`);

      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
      });

      // Se o alerta já foi resolvido de alguma forma (não está mais como PENDING), não precisamos notificar contatos secundários
      if (!alert || alert.status !== 'PENDING') {
        console.log(`[BullMQ] Alerta ${alertId} já foi processado (${alert?.status}), não será necessário notificar contatos secundários`);
        return;
      }

      console.log(`[BullMQ] Alerta ${alertId} ainda pendente após timeout. Notificando contatos secundários...`);

      const patient = await this.prismaService.user.findUnique({
        where: { id: patientId },
      });

      // Busca contatos secundários (prioridade > 1)
      const secondaryContacts = await this.prismaService.emergencyContact.findMany({
        where: { 
          patientId: patientId,
          priority: { gt: 1 } // Prioridade maior que 1
        },
        orderBy: { priority: 'asc' } // Ordenar por prioridade
      });

      if (secondaryContacts.length === 0) {
        console.log(`[BullMQ] Nenhum contato secundário encontrado para o paciente ${patientId}`);
        return;
      }

      const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;

      // Notifica todos os contatos secundários
      for (const contact of secondaryContacts) {
        try {
          console.log(`[BullMQ] Enviando notificação para contato secundário: ${contact.name} (prioridade ${contact.priority})`);
          
          await this.twilioService.sendWhatsAppMessage(
            contact.phone,
            `⚠️ ATENÇÃO - Contato Secundário\n\nDetectamos uma possível queda de *${patient?.name}* e não obtivemos resposta do contato prioritário.\n\n📍 Localização: ${googleMapsLink}\n\nPor favor, nos ajude respondendo:\n✅ "Falso Alerta" - se souber que está tudo bem\n🏃 "Estou Indo Verificar" - se vai checar pessoalmente\n\nContamos com você! 🙏`
          );
          
          // Tenta ligar para o contato secundário também
          try {
            console.log(`[BullMQ] Tentando ligar para contato secundário: ${contact.name}`);
            const call = await this.twilioService.makeFallAlertCall(contact.phone, patient?.name);
            
            console.log(`[BullMQ] Chamada iniciada para contato secundário ${contact.name}. SID: ${call.sid}`);
            
            // Agenda monitoramento desta chamada
            await this.alertsQueue.add(
              'monitorCall',
              { 
                alertId: alertId,
                callSid: call.sid,
                contactId: contact.id,
                contactName: contact.name,
                patientName: patient?.name
              },
              { delay: 5000 }, // Começa a monitorar após 5 segundos
            );
            
          } catch (err) {
            console.error(`[BullMQ] Erro ao ligar para contato secundário ${contact.name}:`, err);
          }
          
        } catch (error) {
          console.error(`[BullMQ] Erro ao notificar contato secundário ${contact.name}:`, error);
        }
      }
    }
    
    // 🆕 Job para monitorar chamadas
    if (job.name === 'monitorCall') {
      const { alertId, callSid, contactId, contactName, patientName } = job.data;
      console.log(`[BullMQ] Iniciando monitoramento da chamada ${callSid} para ${contactName}`);

      try {
        // Verifica se o alerta ainda existe e está pendente
        const alert = await this.prismaService.fallAlert.findUnique({
          where: { id: alertId },
        });

        if (!alert) {
          console.log(`[BullMQ] Alerta ${alertId} não encontrado, cancelando monitoramento`);
          return;
        }

        if (alert.status !== 'PENDING') {
          console.log(`[BullMQ] Alerta ${alertId} já foi processado (${alert.status}), cancelando monitoramento`);
          return;
        }

        // Monitoramento da chamada
        let tempoDecorrido = 0;
        const intervaloVerificacao = 15000; // 15 segundos
        const tempoMaximoEspera = 90000; // 1.5 minuto
        let chamadaFinalizada = false;

        console.log(`🔄 [BullMQ] Iniciando monitoramento da chamada (verificando a cada ${intervaloVerificacao/1000}s por até ${tempoMaximoEspera/1000}s)`);

        // Loop para verificar periodicamente o status da chamada
        while (tempoDecorrido < tempoMaximoEspera && !chamadaFinalizada) {
          // Aguarda o intervalo de verificação
          console.log(`⏰ [BullMQ] Aguardando ${intervaloVerificacao/1000} segundos antes da próxima verificação...`);
          await new Promise(resolve => setTimeout(resolve, intervaloVerificacao));
          tempoDecorrido += intervaloVerificacao;

          // Verifica o status atual
          try {
            const callRecord = await this.twilioService.client.calls(callSid).fetch();
            console.log(`📞 [BullMQ] [${tempoDecorrido / 1000}s] Status da chamada para ${contactName}: ${callRecord.status}`);

            // Se a chamada foi atendida
            if (callRecord.status === 'completed' || callRecord.status === 'in-progress') {
              console.log(`🎉 [BullMQ] CHAMADA ATENDIDA por ${contactName}! Status: ${callRecord.status}`);
              chamadaFinalizada = true;

              // Verifica se o alerta ainda está pendente
              const currentAlert = await this.prismaService.fallAlert.findUnique({
                where: { id: alertId },
              });

              if (currentAlert && currentAlert.status === 'PENDING') {
                // Marca como resolvido
                await this.prismaService.fallAlert.update({
                  where: { id: alertId },
                  data: { 
                    status: 'RESOLVED',
                    confirmedByContactId: contactId,
                    respondedAt: new Date()
                  },
                });

                console.log(`✅ [BullMQ] Alerta ${alertId} marcado como RESOLVED porque ${contactName} atendeu à chamada.`);

                // Emite evento para o WebSocket
                this.gateway.emitAlertStatusChange({
                  id: alertId,
                  patientId: currentAlert.patientId,
                  status: 'RESOLVED',
                  respondedBy: contactId,
                });

                // Envia confirmação por WhatsApp
                const contact = await this.prismaService.emergencyContact.findUnique({
                  where: { id: contactId }
                });

                if (contact) {
                  await this.twilioService.sendCallAnsweredConfirmationWhatsApp(contact.phone, {
                    contactName: contactName,
                    patientName: patientName
                  });
                }

                // Cancela outros jobs relacionados ao alerta
                const jobs = await this.alertsQueue.getJobs(['delayed']);
                for (const relatedJob of jobs) {
                  if (relatedJob.data.alertId === alertId && relatedJob.id !== job.id) {
                    console.log(`[BullMQ] Cancelando job ${relatedJob.id} (${relatedJob.name}) porque alerta foi resolvido por chamada`);
                    await relatedJob.remove();
                  }
                }
              }

            } else if (callRecord.status === 'failed' || 
                      callRecord.status === 'busy' || 
                      callRecord.status === 'no-answer' || 
                      callRecord.status === 'canceled') {
              console.log(`❌ [BullMQ] Chamada finalizada para ${contactName} com status: ${callRecord.status}`);
              chamadaFinalizada = true;
            } else {
              console.log(`🔄 [BullMQ] Chamada ainda com status '${callRecord.status}', continuando monitoramento...`);
            }

          } catch (error) {
            console.error(`❌ [BullMQ] Erro ao verificar status da chamada: ${error.message}`);
            chamadaFinalizada = true;
          }
        }

        if (!chamadaFinalizada) {
          console.log(`⏰ [BullMQ] Tempo máximo de monitoramento atingido para chamada ${callSid}`);
        }

      } catch (error) {
        console.error(`[BullMQ] Erro no monitoramento da chamada ${callSid}:`, error);
      }
    }
  }
}
