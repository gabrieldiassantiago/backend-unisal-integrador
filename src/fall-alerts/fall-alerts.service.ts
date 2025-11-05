// fall-alerts.service.ts
import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { FallAlertsGateway } from './fall-alerts.gateway';
import { CreateFallAlertDto } from './dtos/create-fall-alert.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { deviceNotExisting } from '@src/errors/deviceNoExist';
import { alertNoExisting } from '@src/errors/alertNoExistint';
import { TwilioService } from '@src/twilio/twilio.service';
import { FamilyService } from '@src/family/family.service';

@Injectable()
export class FallAlertsService {
  constructor(
    @InjectQueue('fall-alerts') private alertsQueue: Queue,
    private readonly prismaService: PrismaService,
    private readonly gateway: FallAlertsGateway,
    private readonly twilioService: TwilioService,
    private readonly familyService: FamilyService,
  ) {}

  async createAlert(data: CreateFallAlertDto) {

    const device = await this.prismaService.device.findUnique({
      where: { deviceIdentifier: data.serial },
      select: {
        id: true,
        patientId: true,
        apiKeyHash: true,
        deviceIdentifier: true
      }
    });
    
    if (!device) {
      throw new deviceNotExisting(data.serial);
    }

    console.time('🔍 Create alert in DB');
    const alert = await this.prismaService.fallAlert.create({
      data: {
        deviceId: device.id,
        patientId: device.patientId,
        latitude: data.latitude,
        longitude: data.longitude,
        status: 'PENDING',
      },
      select: {
        id: true,
        deviceId: true,
        patientId: true,
        latitude: true,
        longitude: true,
        createdAt: true,
        status: true
      }
    });
    console.timeEnd('🔍 Create alert in DB');

    const payload = {
      id: alert.id,
      deviceId: alert.deviceId,
      patientId: alert.patientId,
      latitude: alert.latitude,
      longitude: alert.longitude,
      createdAt: alert.createdAt,
      status: alert.status,
    };

    console.time('🔍 WebSocket emit');
    this.gateway.emitNewAlert(payload);
    console.timeEnd('🔍 WebSocket emit');

    // Buscar tokens de cuidadores principais vinculados ao paciente
    const caregiverTokens = await this.prismaService.pushToken.findMany({
      where: {
        user: {
          patients: {
            some: { id: device.patientId }
          }
        }
      },
      select: { token: true }
    });

    // Buscar tokens de familiares vinculados ao paciente com permissão para ver alertas
    const familyMemberTokens = await this.prismaService.pushToken.findMany({
      where: {
        user: {
          role: 'FAMILY_MEMBER',
          familyMemberRelations: {
            some: {
              patientId: device.patientId,
              acceptedAt: { not: null },
              revokedAt: null,
              permissions: {
                canViewAlerts: true
              }
            }
          }
        }
      },
      select: { token: true }
    });

    await Promise.all([
      this.alertsQueue.add(
        'processInitialAlert',
        { 
          alertId: alert.id,
          patientId: device.patientId,
          latitude: data.latitude,
          longitude: data.longitude
        },
        { 
          priority: 10,
          delay: 100
        }
      ),
      this.alertsQueue.add(
        'notifySecondaryContacts',
        { 
          alertId: alert.id,
          patientId: device.patientId,
          latitude: data.latitude,
          longitude: data.longitude
        },
        { delay: 180000 }
      ),
      this.alertsQueue.add(
        'autoConfirm',
        { alertId: alert.id },
        { delay: 300000 }
      )
    ]);
    console.timeEnd('🔍 Queue jobs');

    console.timeEnd('🔍 TOTAL createAlert');
    return payload;
  }

  // Helper para verificar se usuário pode responder alertas
  private async canUserRespondAlert(userId: string, patientId: string): Promise<boolean> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) return false;

    // Cuidador principal sempre pode responder
    if (user.role === 'CAREGIVER') {
      const caregiverPatient = await this.prismaService.caregiverPatient.findUnique({
        where: {
          caregiverId_patientId: {
            caregiverId: userId,
            patientId: patientId,
          },
        },
      });
      return !!caregiverPatient;
    }

    // Familiar precisa ter permissão canRespondAlerts
    if (user.role === 'FAMILY_MEMBER') {
      const permissions = await this.familyService.getFamilyPermissions(userId, patientId);
      return permissions?.canRespondAlerts ?? false;
    }

    return false;
  }

  //  Marcar como falso alerta
  async markFalseAlarm(alertId: string, caregiverId: string) {
    try {
      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
      });

      if (!alert) throw new alertNoExisting(alertId);

      if (alert.status !== 'PENDING') {
        throw new BadRequestException('Alerta já foi processado');
      }

      // Verificar permissão para responder alerta
      const canRespond = await this.canUserRespondAlert(caregiverId, alert.patientId);
      if (!canRespond) {
        throw new ForbiddenException('Você não tem permissão para responder este alerta');
      }

      const patient = await this.prismaService.user.findUnique({
        where: { id: alert.patientId },
      });

      const caregiver = await this.prismaService.user.findUnique({
        where: { id: caregiverId },
      });

      if (!caregiver) {
        throw new BadRequestException(`Usuário não encontrado: ${caregiverId}`);
      }

      // Atualiza status
      const updated = await this.prismaService.fallAlert.update({
        where: { id: alertId },
        data: { 
          status: 'FALSE_ALARM',
          respondedBy: caregiverId,
          respondedAt: new Date(),
        },
      });

      console.log(`✅ Alerta ${alertId} marcado como FALSE_ALARM no banco`);

      // Notifica todos os cuidadores (com try/catch individual)
      try {
        const allCaregivers = await this.prismaService.emergencyContact.findMany({
          where: { patientId: alert.patientId },
        });

        for (const contact of allCaregivers) {
          try {
            await this.twilioService.sendFalseAlarmWhatsApp(contact.phone, {
              patientName: patient?.name || 'Paciente',
              responderName: caregiver?.name || 'Cuidador'
            });
          } catch (whatsappError) {
            console.error(`❌ Erro ao enviar WhatsApp para ${contact.name}:`, whatsappError);
            // Não interrompe o fluxo
          }
        }
      } catch (notifyError) {
        console.error('❌ Erro ao notificar cuidadores:', notifyError);
        // Não interrompe o fluxo
      }

      // Emite via WebSocket (com try/catch)
      try {
        this.gateway.emitAlertStatusChange({
          id: updated.id,
          patientId: updated.patientId,
          status: updated.status,
          respondedBy: caregiverId,
        });
        console.log(`✅ WebSocket emitido com sucesso para alerta ${alertId}`);
      } catch (wsError) {
        console.error('❌ Erro ao emitir WebSocket:', wsError);
        // Não interrompe o fluxo
      }

      // Cancela todos os jobs relacionados (com try/catch)
      try {
        const jobs = await this.alertsQueue.getJobs(['delayed']);
        let canceledCount = 0;
        
        for (const job of jobs) {
          if (job.data.alertId === alertId) {
            console.log(`🗑️ Cancelando job ${job.id} (${job.name}) relacionado ao alerta ${alertId}`);
            await job.remove();
            canceledCount++;
          }
        }
        
        console.log(`✅ ${canceledCount} jobs cancelados com sucesso`);
      } catch (queueError) {
        console.error('❌ Erro ao cancelar jobs da fila:', queueError);
        // Não interrompe o fluxo
      }

      return {
        id: updated.id,
        caregiverId: caregiverId,
        status: updated.status
      };
    } catch (error) {
      console.error('❌ Erro em markFalseAlarm:', error);
      
      // Se for um erro conhecido, relança
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      // Caso contrário, lança erro genérico
      throw new InternalServerErrorException({
        message: 'Erro ao marcar alerta como falso alarme',
        details: error.message
      });
    }
  }

  // Marcar como "estou verificando"
  async markVerifying(alertId: string, caregiverId: string) {
    try {
      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
      });

      if (!alert) throw new alertNoExisting(alertId);
      
      if (alert.status !== 'PENDING') {
        throw new BadRequestException('Alerta já foi processado');
      }

      // Verificar permissão para responder alerta
      const canRespond = await this.canUserRespondAlert(caregiverId, alert.patientId);
      if (!canRespond) {
        throw new ForbiddenException('Você não tem permissão para responder este alerta');
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

      console.log(`✅ Alerta ${alertId} marcado como VERIFYING no banco`);

      // Emite via WebSocket (com try/catch)
      try {
        this.gateway.emitAlertStatusChange({
          id: updated.id,
          patientId: updated.patientId,
          status: updated.status,
          respondedBy: caregiverId,
          verificationDeadline,
        });
        console.log(`✅ WebSocket emitido com sucesso para alerta ${alertId}`);
      } catch (wsError) {
        console.error('❌ Erro ao emitir WebSocket:', wsError);
      }

      // Cancela job de notificar contatos secundários (com try/catch)
      try {
        const jobs = await this.alertsQueue.getJobs(['delayed']);
        for (const job of jobs) {
          if (job.data.alertId === alertId && job.name === 'notifySecondaryContacts') {
            console.log(`🗑️ Cancelando job ${job.id} (${job.name}) relacionado ao alerta ${alertId}`);
            await job.remove();
          }
        }
      } catch (queueError) {
        console.error('❌ Erro ao cancelar jobs da fila:', queueError);
      }

      // Agenda job para cobrar confirmação (com try/catch)
      try {
        await this.alertsQueue.add(
          'requestConfirmation',
          { alertId: alert.id, caregiverId },
          { delay: 10000 }, // 10 segundos
        );
        console.log(`✅ Job requestConfirmation agendado para 10 segundos`);
      } catch (queueError) {
        console.error('❌ Erro ao agendar job requestConfirmation:', queueError);
      }

      // Notifica outros cuidadores (com try/catch)
      try {
        const patient = await this.prismaService.user.findUnique({
          where: { id: alert.patientId },
        });

        const allCaregivers = await this.prismaService.emergencyContact.findMany({
          where: { patientId: alert.patientId },
        });

        for (const contact of allCaregivers) {
          if (contact.id !== caregiverId) {
            try {
              const message = `Oi! 👋

*${caregiver?.name}* está indo verificar a situação de *${patient?.name}*.

Em alguns minutos teremos mais informações. 🕐

Fique atento(a) ao celular, caso precisemos de você! 📱`;

              await this.twilioService.sendWhatsAppMessage(contact.phone, message);
            } catch (whatsappError) {
              console.error(`❌ Erro ao enviar WhatsApp para ${contact.name}:`, whatsappError);
            }
          }
        }
      } catch (notifyError) {
        console.error('❌ Erro ao notificar cuidadores:', notifyError);
      }

      return updated;
    } catch (error) {
      console.error('❌ Erro em markVerifying:', error);
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException({
        message: 'Erro ao marcar alerta como verificando',
        details: error.message
      });
    }
  }

  // 🆕 Confirmar após verificação
  async confirmAfterVerification(alertId: string, caregiverId: string) {
    try {
      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
      });

      if (!alert) throw new alertNoExisting(alertId);
      if (alert.status !== 'VERIFYING') {
        throw new BadRequestException('Alerta não está em verificação');
      }

      // Verificar permissão para responder alerta
      const canRespond = await this.canUserRespondAlert(caregiverId, alert.patientId);
      if (!canRespond) {
        throw new ForbiddenException('Você não tem permissão para responder este alerta');
      }

      const patient = await this.prismaService.user.findUnique({
        where: { id: alert.patientId },
      });

      const caregiver = await this.prismaService.user.findUnique({
        where: { id: caregiverId },
      });

      // Notifica todos antes de confirmar (com try/catch)
      try {
        const allCaregivers = await this.prismaService.emergencyContact.findMany({
          where: { patientId: alert.patientId },
        });

        for (const contact of allCaregivers) {
          try {
            const message = `⚠️ ATENÇÃO

*${caregiver?.name}* confirmou que *${patient?.name}* realmente caiu e precisa de ajuda!

Vamos acionar todos os contatos de emergência agora. 🚨`;

            await this.twilioService.sendWhatsAppMessage(contact.phone, message);
          } catch (whatsappError) {
            console.error(`❌ Erro ao enviar WhatsApp para ${contact.name}:`, whatsappError);
          }
        }
      } catch (notifyError) {
        console.error('❌ Erro ao notificar cuidadores:', notifyError);
      }

      return this.confirmAlert(alertId);
    } catch (error) {
      console.error('❌ Erro em confirmAfterVerification:', error);
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException({
        message: 'Erro ao confirmar alerta após verificação',
        details: error.message
      });
    }
  }

  // ✅ Confirmar alerta (prioriza o contato prioritário e só depois envia para secundários)
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
      select: { id: true, phone: true, name: true, priority: true },
      orderBy: { priority: 'asc' },
    });

    if (contatos.length === 0) {
      throw new BadRequestException('Nenhum contato de emergência encontrado para o paciente.');
    }

    const googleMapsLink = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;

    // Separar o contato prioritário e os secundários
    const contatoPrioritario = contatos.find(c => c.priority === 1);
    const contatosSecundarios = contatos.filter(c => c.priority > 1);

    // Lógica de ligação com prioridade e retentativas
    const MAX_TENTATIVAS_POR_CONTATO = 3; // Tenta 3x por contato
    const TEMPO_ESPERA_POR_TENTATIVA_MS = 90000; // 1.5 minutos por tentativa
    const INTERVALO_ENTRE_TENTATIVAS_MS = 10000; // 10 segundos entre tentativas

    let callAnswered = false;
    
    // Primeiro tenta contato prioritário
    if (contatoPrioritario) {
      console.log(`\n⭐ Iniciando tentativas com contato prioritário: ${contatoPrioritario.name}...`);
      
      // Envia WhatsApp para contato prioritário
      try {
        await this.twilioService.sendEmergencyConfirmedWhatsApp(contatoPrioritario.phone, {
          contactName: contatoPrioritario.name,
          patientName: patient.name,
          location: googleMapsLink,
          priority: contatoPrioritario.priority
        });
      } catch (err) {
        console.error(`Falha ao enviar WhatsApp para ${contatoPrioritario.name}:`, err);
      }

      // Tenta ligar múltiplas vezes para o contato prioritário
      for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_POR_CONTATO; tentativa++) {
        if (callAnswered) break;

        try {
          console.log(`📞 Tentativa ${tentativa}/${MAX_TENTATIVAS_POR_CONTATO} - Ligando para ${contatoPrioritario.name} (prioritário)...`);
          
          // Faz a chamada
          const call = await this.twilioService.makeFallAlertCall(contatoPrioritario.phone, patient.name);
          
          console.log(`📱 Chamada iniciada para ${contatoPrioritario.name}. SID: ${call.sid}`);
          console.log(`📞 Status imediato após criação: ${call.status}`);
          
          // Aguarda um pouco para a chamada iniciar
          console.log('⏳ Aguardando 5 segundos para a chamada iniciar...');
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Monitoramento contínuo da chamada
          let callRecord = await this.twilioService.client.calls(call.sid).fetch();
          console.log(`📞 Status inicial da chamada para ${contatoPrioritario.name}: ${callRecord.status}`);
          
          let tempoDecorrido = 5000; // Já aguardamos 5 segundos
          const intervaloVerificacao = 15000; // Verifica a cada 15 segundos
          const tempoMaximoEspera = TEMPO_ESPERA_POR_TENTATIVA_MS;
          let chamadaFinalizada = false;
          
          console.log(`🔄 Iniciando monitoramento da chamada (verificando a cada ${intervaloVerificacao/1000}s por até ${tempoMaximoEspera/1000}s)`);
          
          // Loop para verificar periodicamente o status da chamada
          while (tempoDecorrido < tempoMaximoEspera && !chamadaFinalizada) {
            // Aguarda o intervalo de verificação
            console.log(`⏰ Aguardando ${intervaloVerificacao/1000} segundos antes da próxima verificação...`);
            await new Promise(resolve => setTimeout(resolve, intervaloVerificacao));
            tempoDecorrido += intervaloVerificacao;
            
            // Verifica o status atual
            try {
              callRecord = await this.twilioService.client.calls(call.sid).fetch();
              console.log(`📞 [${tempoDecorrido / 1000}s] Status da chamada para ${contatoPrioritario.name}: ${callRecord.status}`);
              
              // Se a chamada foi atendida ou falhou/terminou, encerra o loop
              if (callRecord.status === 'completed' || 
                  callRecord.status === 'in-progress' || 
                  callRecord.status === 'failed' ||
                  callRecord.status === 'busy' ||
                  callRecord.status === 'no-answer' ||
                  callRecord.status === 'canceled') {
                chamadaFinalizada = true;
                console.log(`✅ Chamada finalizada para ${contatoPrioritario.name} com status: ${callRecord.status} após ${tempoDecorrido/1000}s`);
              } else {
                console.log(`🔄 Chamada ainda com status '${callRecord.status}', continuando monitoramento...`);
              }
            } catch (error) {
              console.error(`❌ Erro ao verificar status da chamada: ${error.message}`);
              // Se houver erro, considera a chamada como finalizada
              chamadaFinalizada = true;
            }
          }
          
          // Se o tempo máximo foi atingido sem um status conclusivo, verifica uma última vez
          if (!chamadaFinalizada) {
            try {
              callRecord = await this.twilioService.client.calls(call.sid).fetch();
              console.log(`⏰ Tempo máximo atingido (${tempoMaximoEspera/1000}s). Status final da chamada para ${contatoPrioritario.name}: ${callRecord.status}`);
            } catch (error) {
              console.error(`❌ Erro na verificação final: ${error.message}`);
            }
          }

          // Verifica se a chamada foi atendida
          // 'completed' = chamada foi atendida e finalizada 
          // 'in-progress' = chamada foi atendida e ainda está em andamento
          
          if (callRecord.status === 'completed') {
            console.log(`🎉 CHAMADA ATENDIDA por ${contatoPrioritario.name} na tentativa ${tentativa}! Status: ${callRecord.status}`);
            callAnswered = true;

            // Verifica o status atual do alerta para ver se já foi resolvido pelo app
            const currentAlert = await this.prismaService.fallAlert.findUnique({
              where: { id: alertId },
            });

            // Se o alerta ainda estiver pendente, marca como RESOLVED
            if (currentAlert && currentAlert.status === 'PENDING') {
              await this.prismaService.fallAlert.update({
                where: { id: alertId },
                data: { 
                  status: 'RESOLVED',
                  confirmedByContactId: contatoPrioritario.id,
                  respondedAt: new Date()
                },
              });

              console.log(`✅ Alerta ${alertId} marcado como RESOLVED porque ${contatoPrioritario.name} atendeu à chamada.`);

              // Emite evento para o WebSocket
              this.gateway.emitAlertStatusChange({
                id: alertId,
                patientId: currentAlert.patientId,
                status: 'RESOLVED',
                respondedBy: contatoPrioritario.id,
              });
              
              // Cancela todos os jobs relacionados a este alerta (auto confirmação e notificação de contatos secundários)
              const jobs = await this.alertsQueue.getJobs(['delayed']);
              for (const job of jobs) {
                if (job.data.alertId === alertId) {
                  console.log(`Cancelando job ${job.id} (${job.name}) relacionado ao alerta ${alertId} porque foi resolvido por chamada`);
                  await job.remove();
                }
              }
              
              // Notifica outros contatos de emergência que o alerta foi resolvido pelo contato prioritário
              if (contatosSecundarios.length > 0) {
                for (const secundario of contatosSecundarios) {
                  await this.twilioService.sendAlertResolvedWhatsApp(secundario.phone, {
                    patientName: patient.name,
                    responderName: `${contatoPrioritario.name} (contato prioritário)`,
                    resolvedByCall: true
                  });
                }
              }
            }

            // Envia confirmação por WhatsApp
            await this.twilioService.sendCallAnsweredConfirmationWhatsApp(contatoPrioritario.phone, {
              contactName: contatoPrioritario.name,
              patientName: patient.name
            });
            break; // Sai do loop de tentativas
          } else {
            console.log(`❌ Tentativa ${tentativa} - Chamada não atendida pelo contato prioritário (status: ${callRecord.status})`);
            
            // Se não foi a última tentativa, aguarda um intervalo antes de tentar novamente
            if (tentativa < MAX_TENTATIVAS_POR_CONTATO) {
              console.log(`⏳ Aguardando ${INTERVALO_ENTRE_TENTATIVAS_MS / 1000}s antes da próxima tentativa...`);
              await new Promise(resolve => setTimeout(resolve, INTERVALO_ENTRE_TENTATIVAS_MS));
            } else {
              console.log(`⚠️ ${contatoPrioritario.name} (contato prioritário) não atendeu após ${MAX_TENTATIVAS_POR_CONTATO} tentativas.`);
            }
          }
        } catch (err) {
          console.error(`❌ Erro na tentativa ${tentativa} para ${contatoPrioritario.name}:`, err);
          
          // Se não for a última tentativa e houve erro, tenta novamente após intervalo
          if (tentativa < MAX_TENTATIVAS_POR_CONTATO) {
            await new Promise(resolve => setTimeout(resolve, INTERVALO_ENTRE_TENTATIVAS_MS));
          }
        }
      }
    }
    
    // Se o contato prioritário não atendeu, continua com os secundários
    if (!callAnswered && contatosSecundarios.length > 0) {
      console.log(`\n➡️ Contato prioritário não atendeu. Tentando contatos secundários...`);
      
      // Envia mensagem para todos os contatos secundários
      for (const contact of contatosSecundarios) {
        try {
          const message = `🚨 EMERGÊNCIA - Queda Confirmada

Olá, ${contact.name}!

*${patient.name}* sofreu uma queda e precisa de ajuda URGENTE! O contato prioritário não atendeu.

📍 Última localização conhecida:
${googleMapsLink}

⚠️ Por favor:
• Vá verificar o mais rápido possível
• Ligue para emergência se necessário (192/193)
• Avise outros familiares

Cada segundo conta! 🙏

(Contato de prioridade ${contact.priority})`;

          await this.twilioService.sendWhatsAppMessage(contact.phone, message);
        } catch (err) {
          console.error(`Falha ao enviar WhatsApp para ${contact.name}:`, err);
        }
      }
      
      // Tenta ligar para cada contato secundário
      for (const contact of contatosSecundarios) {
        if (callAnswered) break;
  
        console.log(`\n🔄 Iniciando tentativas com ${contact.name} (prioridade ${contact.priority})...`);
  
        // Tenta ligar múltiplas vezes para o mesmo contato
        for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_POR_CONTATO; tentativa++) {
          if (callAnswered) break;
  
          try {
            console.log(`📞 Tentativa ${tentativa}/${MAX_TENTATIVAS_POR_CONTATO} - Ligando para ${contact.name}...`);
            
            // Faz a chamada
            const call = await this.twilioService.makeFallAlertCall(contact.phone, patient.name);
            
            console.log(`📱 Chamada iniciada para ${contact.name}. SID: ${call.sid}`);
            console.log(`📞 Status imediato após criação: ${call.status}`);
            
            // Aguarda um pouco para a chamada iniciar
            console.log('⏳ Aguardando 5 segundos para a chamada iniciar...');
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            // Monitoramento contínuo da chamada
            let callRecord = await this.twilioService.client.calls(call.sid).fetch();
            console.log(`📞 Status inicial da chamada para ${contact.name}: ${callRecord.status}`);
            
            let tempoDecorrido = 5000; // Já aguardamos 5 segundos
            const intervaloVerificacao = 15000; // Verifica a cada 15 segundos
            const tempoMaximoEspera = TEMPO_ESPERA_POR_TENTATIVA_MS;
            let chamadaFinalizada = false;
            
            console.log(`🔄 Iniciando monitoramento da chamada (verificando a cada ${intervaloVerificacao/1000}s por até ${tempoMaximoEspera/1000}s)`);
            
            // Loop para verificar periodicamente o status da chamada
            while (tempoDecorrido < tempoMaximoEspera && !chamadaFinalizada) {
              // Aguarda o intervalo de verificação
              console.log(`⏰ Aguardando ${intervaloVerificacao/1000} segundos antes da próxima verificação...`);
              await new Promise(resolve => setTimeout(resolve, intervaloVerificacao));
              tempoDecorrido += intervaloVerificacao;
              
              // Verifica o status atual
              try {
                callRecord = await this.twilioService.client.calls(call.sid).fetch();
                console.log(`📞 [${tempoDecorrido / 1000}s] Status da chamada para ${contact.name}: ${callRecord.status}`);
                
                // Se a chamada foi atendida ou falhou/terminou, encerra o loop
                if (callRecord.status === 'completed' || 
                    callRecord.status === 'in-progress' || 
                    callRecord.status === 'failed' ||
                    callRecord.status === 'busy' ||
                    callRecord.status === 'no-answer' ||
                    callRecord.status === 'canceled') {
                  chamadaFinalizada = true;
                  console.log(`✅ Chamada finalizada para ${contact.name} com status: ${callRecord.status} após ${tempoDecorrido/1000}s`);
                } else {
                  console.log(`🔄 Chamada ainda com status '${callRecord.status}', continuando monitoramento...`);
                }
              } catch (error) {
                console.error(`❌ Erro ao verificar status da chamada: ${error.message}`);
                // Se houver erro, considera a chamada como finalizada
                chamadaFinalizada = true;
              }
            }
            
            // Se o tempo máximo foi atingido sem um status conclusivo, verifica uma última vez
            if (!chamadaFinalizada) {
              try {
                callRecord = await this.twilioService.client.calls(call.sid).fetch();
                console.log(`⏰ Tempo máximo atingido (${tempoMaximoEspera/1000}s). Status final da chamada para ${contact.name}: ${callRecord.status}`);
              } catch (error) {
                console.error(`❌ Erro na verificação final: ${error.message}`);
              }
            }
  
            // Verifica se a chamada foi atendida
            // 'completed' = chamada foi atendida e finalizada 
            // 'in-progress' = chamada foi atendida e ainda está em andamento
            if (callRecord.status === 'completed' || callRecord.status === 'in-progress') {
              console.log(`🎉 CHAMADA ATENDIDA por ${contact.name} na tentativa ${tentativa}! Status: ${callRecord.status}`);
              callAnswered = true;
  
              // Verifica o status atual do alerta para ver se já foi resolvido pelo app
              const currentAlert = await this.prismaService.fallAlert.findUnique({
                where: { id: alertId },
              });

              // Se o alerta ainda estiver pendente, marca como RESOLVED
              if (currentAlert && currentAlert.status === 'PENDING') {
                await this.prismaService.fallAlert.update({
                  where: { id: alertId },
                  data: { 
                    status: 'RESOLVED',
                    confirmedByContactId: contact.id,
                    respondedAt: new Date()
                  },
                });

                console.log(`✅ Alerta ${alertId} marcado como RESOLVED porque ${contact.name} atendeu à chamada.`);

                // Emite evento para o WebSocket
                this.gateway.emitAlertStatusChange({
                  id: alertId,
                  patientId: currentAlert.patientId,
                  status: 'RESOLVED',
                  respondedBy: contact.id,
                });
                
                // Cancela todos os jobs relacionados a este alerta (auto confirmação e notificação de contatos secundários)
                const jobs = await this.alertsQueue.getJobs(['delayed']);
                for (const job of jobs) {
                  if (job.data.alertId === alertId) {
                    console.log(`Cancelando job ${job.id} (${job.name}) relacionado ao alerta ${alertId} porque foi resolvido por chamada`);
                    await job.remove();
                  }
                }
                
                // Notifica o contato prioritário e outros contatos secundários
                for (const outroContato of contatos) {
                  if (outroContato.id !== contact.id) { // Não notifica quem atendeu
                    await this.twilioService.sendAlertResolvedWhatsApp(outroContato.phone, {
                      patientName: patient.name,
                      responderName: `${contact.name} (contato de prioridade ${contact.priority})`,
                      resolvedByCall: true
                    });
                  }
                }
              }

              // Envia confirmação por WhatsApp
              await this.twilioService.sendCallAnsweredConfirmationWhatsApp(contact.phone, {
                contactName: contact.name,
                patientName: patient.name
              });
              break; // Sai do loop de tentativas
            } else {
              console.log(`❌ Tentativa ${tentativa} - Chamada não atendida (status: ${callRecord.status})`);
              
              // Se não foi a última tentativa, aguarda um intervalo antes de tentar novamente
              if (tentativa < MAX_TENTATIVAS_POR_CONTATO) {
                console.log(`⏳ Aguardando ${INTERVALO_ENTRE_TENTATIVAS_MS / 1000}s antes da próxima tentativa...`);
                await new Promise(resolve => setTimeout(resolve, INTERVALO_ENTRE_TENTATIVAS_MS));
              } else {
                console.log(`⚠️ ${contact.name} não atendeu após ${MAX_TENTATIVAS_POR_CONTATO} tentativas. Passando para o próximo contato.`);
              }
            }
          } catch (err) {
            console.error(`❌ Erro na tentativa ${tentativa} para ${contact.name}:`, err);
            
            // Se não for a última tentativa e houve erro, tenta novamente após intervalo
            if (tentativa < MAX_TENTATIVAS_POR_CONTATO) {
              await new Promise(resolve => setTimeout(resolve, INTERVALO_ENTRE_TENTATIVAS_MS));
            }
          }
        }
      }
    }

    if (!callAnswered) {
      console.log('⚠️ Nenhum contato de emergência atendeu à chamada.');
      
      // Envia mensagem extra para todos
      for (const contact of contatos) {
        const message = `⚠️ ÚLTIMA TENTATIVA

Não conseguimos contato telefônico com ninguém!

Por favor, ${contact.name}, verifique *${patient.name}* URGENTEMENTE!

📍 ${googleMapsLink}

RESPONDA ESTA MENSAGEM quando chegar! 🙏`;

        await this.twilioService.sendWhatsAppMessage(contact.phone, message);
      }
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
