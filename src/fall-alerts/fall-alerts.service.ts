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
import axios from 'axios';

@Injectable()
export class FallAlertsService {
  private expoApiUrl = 'https://exp.host/--/api/v2/push/send';

  constructor(
    @InjectQueue('fall-alerts') private alertsQueue: Queue,
    private readonly prismaService: PrismaService,
    private readonly gateway: FallAlertsGateway,
    private readonly twilioService: TwilioService,
    private readonly familyService: FamilyService,
  ) {}

  // 📱 Enviar notificação push via Expo
  private async sendExpoPushNotification(
    expoPushToken: string,
    title: string,
    body: string,
    data: any = {}
  ) {
    try {
      await axios.post(
        this.expoApiUrl,
        {
          to: expoPushToken,
          sound: 'default',
          title,
          body,
          data,
          priority: 'high',
        },
        {
          headers: { 'Content-Type': 'application/json' },
        }
      );
      console.log(`✅ Push enviado para ${expoPushToken.substring(0, 20)}...`);
    } catch (error) {
      console.error(`❌ Erro ao enviar push Expo:`, error.message);
    }
  }

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

    // 📱 Buscar tokens Expo dos cuidadores e familiares
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

    // 📲 Enviar notificações push Expo para todos
    const allTokens = [...caregiverTokens, ...familyMemberTokens].map(t => t.token);
    
    const patient = await this.prismaService.user.findUnique({
      where: { id: device.patientId },
      select: { name: true }
    });

    for (const token of allTokens) {
      await this.sendExpoPushNotification(
        token,
        '🚨 ALERTA DE QUEDA',
        `${patient?.name} pode ter caído!`,
        {
          patientId: device.patientId,
          alertId: alert.id,
          latitude: alert.latitude,
          longitude: alert.longitude,
        }
      );
    }

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

    return payload;
  }

  private async canUserRespondAlert(userId: string, patientId: string): Promise<boolean> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (!user) return false;

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

    if (user.role === 'FAMILY_MEMBER') {
      const permissions = await this.familyService.getFamilyPermissions(userId, patientId);
      return permissions?.canRespondAlerts ?? false;
    }

    return false;
  }

  async markFalseAlarm(alertId: string, caregiverId: string) {
    try {
      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
      });

      if (!alert) throw new alertNoExisting(alertId);

      if (alert.status !== 'PENDING') {
        throw new BadRequestException('Alerta já foi processado');
      }

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

      const updated = await this.prismaService.fallAlert.update({
        where: { id: alertId },
        data: { 
          status: 'FALSE_ALARM',
          respondedBy: caregiverId,
          respondedAt: new Date(),
        },
      });

      console.log(`✅ Alerta ${alertId} marcado como FALSE_ALARM`);

      // Notificar via WhatsApp
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
          }
        }
      } catch (notifyError) {
        console.error('❌ Erro ao notificar cuidadores:', notifyError);
      }

      try {
        this.gateway.emitAlertStatusChange({
          id: updated.id,
          patientId: updated.patientId,
          status: updated.status,
          respondedBy: caregiverId,
        });
        console.log(`✅ WebSocket emitido para alerta ${alertId}`);
      } catch (wsError) {
        console.error('❌ Erro ao emitir WebSocket:', wsError);
      }

      try {
        const jobs = await this.alertsQueue.getJobs(['delayed']);
        let canceledCount = 0;
        
        for (const job of jobs) {
          if (job.data.alertId === alertId) {
            console.log(`🗑️ Cancelando job ${job.id}`);
            await job.remove();
            canceledCount++;
          }
        }
        
        console.log(`✅ ${canceledCount} jobs cancelados`);
      } catch (queueError) {
        console.error('❌ Erro ao cancelar jobs:', queueError);
      }

      return {
        id: updated.id,
        caregiverId: caregiverId,
        status: updated.status
      };
    } catch (error) {
      console.error('❌ Erro em markFalseAlarm:', error);
      
      if (error instanceof NotFoundException || error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException({
        message: 'Erro ao marcar alerta como falso alarme',
        details: error.message
      });
    }
  }

  async markVerifying(alertId: string, caregiverId: string) {
    try {
      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
      });

      if (!alert) throw new alertNoExisting(alertId);
      
      if (alert.status !== 'PENDING') {
        throw new BadRequestException('Alerta já foi processado');
      }

      const canRespond = await this.canUserRespondAlert(caregiverId, alert.patientId);
      if (!canRespond) {
        throw new ForbiddenException('Você não tem permissão para responder este alerta');
      }

      const caregiver = await this.prismaService.user.findUnique({
        where: { id: caregiverId },
      });

      const verificationDeadline = new Date(Date.now() + 120000);
      const updated = await this.prismaService.fallAlert.update({
        where: { id: alertId },
        data: { 
          status: 'VERIFYING',
          respondedBy: caregiverId,
          respondedAt: new Date(),
          verificationDeadline,
        },
      });

      console.log(`✅ Alerta ${alertId} marcado como VERIFYING`);

      try {
        this.gateway.emitAlertStatusChange({
          id: updated.id,
          patientId: updated.patientId,
          status: updated.status,
          respondedBy: caregiverId,
          verificationDeadline,
        });
      } catch (wsError) {
        console.error('❌ Erro ao emitir WebSocket:', wsError);
      }

      try {
        const jobs = await this.alertsQueue.getJobs(['delayed']);
        for (const job of jobs) {
          if (job.data.alertId === alertId && job.name === 'notifySecondaryContacts') {
            await job.remove();
          }
        }
      } catch (queueError) {
        console.error('❌ Erro ao cancelar jobs:', queueError);
      }

      try {
        await this.alertsQueue.add(
          'requestConfirmation',
          { alertId: alert.id, caregiverId },
          { delay: 10000 },
        );
      } catch (queueError) {
        console.error('❌ Erro ao agendar job:', queueError);
      }

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
              const message = `Oi! 👋\n\n*${caregiver?.name}* está indo verificar a situação de *${patient?.name}*.\n\nEm alguns minutos teremos mais informações. 🕐\n\nFique atento(a) ao celular! 📱`;
              await this.twilioService.sendWhatsAppMessage(contact.phone, message);
            } catch (whatsappError) {
              console.error(`❌ Erro ao enviar WhatsApp para ${contact.name}:`, whatsappError);
            }
          }
        }
      } catch (notifyError) {
        console.error('❌ Erro ao notificar:', notifyError);
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

  async confirmAfterVerification(alertId: string, caregiverId: string) {
    try {
      const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
      });

      if (!alert) throw new alertNoExisting(alertId);
      if (alert.status !== 'VERIFYING') {
        throw new BadRequestException('Alerta não está em verificação');
      }

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

      try {
        const allCaregivers = await this.prismaService.emergencyContact.findMany({
          where: { patientId: alert.patientId },
        });

        for (const contact of allCaregivers) {
          try {
            const message = `⚠️ ATENÇÃO\n\n*${caregiver?.name}* confirmou que *${patient?.name}* realmente caiu e precisa de ajuda!\n\nVamos acionar todos os contatos de emergência agora. 🚨`;
            await this.twilioService.sendWhatsAppMessage(contact.phone, message);
          } catch (whatsappError) {
            console.error(`❌ Erro ao enviar WhatsApp:`, whatsappError);
          }
        }
      } catch (notifyError) {
        console.error('❌ Erro ao notificar:', notifyError);
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
      throw new BadRequestException('Nenhum contato de emergência encontrado.');
    }

    const googleMapsLink = `https://www.google.com/maps?q=${alert.latitude},${alert.longitude}`;

    const contatoPrioritario = contatos.find(c => c.priority === 1);
    const contatosSecundarios = contatos.filter(c => c.priority > 1);

    const MAX_TENTATIVAS_POR_CONTATO = 3;
    const TEMPO_ESPERA_POR_TENTATIVA_MS = 90000;
    const INTERVALO_ENTRE_TENTATIVAS_MS = 10000;

    let callAnswered = false;
    
    if (contatoPrioritario) {
      console.log(`\n⭐ Iniciando tentativas com: ${contatoPrioritario.name}...`);
      
      try {
        await this.twilioService.sendEmergencyConfirmedWhatsApp(contatoPrioritario.phone, {
          contactName: contatoPrioritario.name,
          patientName: patient.name,
          location: googleMapsLink,
          priority: contatoPrioritario.priority
        });
      } catch (err) {
        console.error(`❌ Erro ao enviar WhatsApp:`, err);
      }

      for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_POR_CONTATO; tentativa++) {
        if (callAnswered) break;

        try {
          console.log(`📞 Tentativa ${tentativa}/${MAX_TENTATIVAS_POR_CONTATO}`);
          
          const call = await this.twilioService.makeFallAlertCall(contatoPrioritario.phone, patient.name);
          console.log(`📱 Chamada iniciada. SID: ${call.sid}`);
          
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          let callRecord = await this.twilioService.client.calls(call.sid).fetch();
          console.log(`📞 Status: ${callRecord.status}`);
          
          let tempoDecorrido = 5000;
          const intervaloVerificacao = 15000;
          let chamadaFinalizada = false;
          
          while (tempoDecorrido < TEMPO_ESPERA_POR_TENTATIVA_MS && !chamadaFinalizada) {
            await new Promise(resolve => setTimeout(resolve, intervaloVerificacao));
            tempoDecorrido += intervaloVerificacao;
            
            try {
              callRecord = await this.twilioService.client.calls(call.sid).fetch();
              console.log(`📞 [${tempoDecorrido / 1000}s] Status: ${callRecord.status}`);
              
              if (['completed', 'in-progress', 'failed', 'busy', 'no-answer', 'canceled'].includes(callRecord.status)) {
                chamadaFinalizada = true;
              }
            } catch (error) {
              console.error(`❌ Erro ao verificar status:`, error.message);
              chamadaFinalizada = true;
            }
          }

          if (callRecord.status === 'completed') {
            console.log(`🎉 CHAMADA ATENDIDA por ${contatoPrioritario.name}!`);
            callAnswered = true;

            const currentAlert = await this.prismaService.fallAlert.findUnique({
              where: { id: alertId },
            });

            if (currentAlert && currentAlert.status === 'PENDING') {
              await this.prismaService.fallAlert.update({
                where: { id: alertId },
                data: { 
                  status: 'RESOLVED',
                  confirmedByContactId: contatoPrioritario.id,
                  respondedAt: new Date()
                },
              });

              this.gateway.emitAlertStatusChange({
                id: alertId,
                patientId: currentAlert.patientId,
                status: 'RESOLVED',
                respondedBy: contatoPrioritario.id,
              });
              
              const jobs = await this.alertsQueue.getJobs(['delayed']);
              for (const job of jobs) {
                if (job.data.alertId === alertId) {
                  await job.remove();
                }
              }
            }

            await this.twilioService.sendCallAnsweredConfirmationWhatsApp(contatoPrioritario.phone, {
              contactName: contatoPrioritario.name,
              patientName: patient.name
            });
            break;
          } else {
            console.log(`❌ Tentativa ${tentativa} - Não atendida (status: ${callRecord.status})`);
            
            if (tentativa < MAX_TENTATIVAS_POR_CONTATO) {
              await new Promise(resolve => setTimeout(resolve, INTERVALO_ENTRE_TENTATIVAS_MS));
            }
          }
        } catch (err) {
          console.error(`❌ Erro na tentativa ${tentativa}:`, err);
          
          if (tentativa < MAX_TENTATIVAS_POR_CONTATO) {
            await new Promise(resolve => setTimeout(resolve, INTERVALO_ENTRE_TENTATIVAS_MS));
          }
        }
      }
    }
    
    if (!callAnswered && contatosSecundarios.length > 0) {
      console.log(`\n➡️ Tentando contatos secundários...`);
      
      for (const contact of contatosSecundarios) {
        try {
          const message = `🚨 EMERGÊNCIA - Queda Confirmada\n\nOlá, ${contact.name}!\n\n*${patient.name}* sofreu uma queda!\n\n📍 ${googleMapsLink}\n\nPor favor verifique URGENTEMENTE! 🙏`;
          await this.twilioService.sendWhatsAppMessage(contact.phone, message);
        } catch (err) {
          console.error(`❌ Erro ao enviar WhatsApp:`, err);
        }
      }

      for (const contact of contatosSecundarios) {
        if (callAnswered) break;

        for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_POR_CONTATO; tentativa++) {
          if (callAnswered) break;

          try {
            console.log(`📞 Tentativa ${tentativa}/${MAX_TENTATIVAS_POR_CONTATO} - ${contact.name}`);
            
            const call = await this.twilioService.makeFallAlertCall(contact.phone, patient.name);
            
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            let callRecord = await this.twilioService.client.calls(call.sid).fetch();
            
            let tempoDecorrido = 5000;
            const intervaloVerificacao = 15000;
            let chamadaFinalizada = false;
            
            while (tempoDecorrido < TEMPO_ESPERA_POR_TENTATIVA_MS && !chamadaFinalizada) {
              await new Promise(resolve => setTimeout(resolve, intervaloVerificacao));
              tempoDecorrido += intervaloVerificacao;
              
              try {
                callRecord = await this.twilioService.client.calls(call.sid).fetch();
                
                if (['completed', 'in-progress', 'failed', 'busy', 'no-answer', 'canceled'].includes(callRecord.status)) {
                  chamadaFinalizada = true;
                }
              } catch (error) {
                chamadaFinalizada = true;
              }
            }

            if (callRecord.status === 'completed' || callRecord.status === 'in-progress') {
              console.log(`🎉 CHAMADA ATENDIDA por ${contact.name}!`);
              callAnswered = true;

              const currentAlert = await this.prismaService.fallAlert.findUnique({
                where: { id: alertId },
              });

              if (currentAlert && currentAlert.status === 'PENDING') {
                await this.prismaService.fallAlert.update({
                  where: { id: alertId },
                  data: { 
                    status: 'RESOLVED',
                    confirmedByContactId: contact.id,
                    respondedAt: new Date()
                  },
                });

                this.gateway.emitAlertStatusChange({
                  id: alertId,
                  patientId: currentAlert.patientId,
                  status: 'RESOLVED',
                  respondedBy: contact.id,
                });
                
                const jobs = await this.alertsQueue.getJobs(['delayed']);
                for (const job of jobs) {
                  if (job.data.alertId === alertId) {
                    await job.remove();
                  }
                }
              }

              await this.twilioService.sendCallAnsweredConfirmationWhatsApp(contact.phone, {
                contactName: contact.name,
                patientName: patient.name
              });
              break;
            } else {
              if (tentativa < MAX_TENTATIVAS_POR_CONTATO) {
                await new Promise(resolve => setTimeout(resolve, INTERVALO_ENTRE_TENTATIVAS_MS));
              }
            }
          } catch (err) {
            console.error(`❌ Erro:`, err);
            
            if (tentativa < MAX_TENTATIVAS_POR_CONTATO) {
              await new Promise(resolve => setTimeout(resolve, INTERVALO_ENTRE_TENTATIVAS_MS));
            }
          }
        }
      }
    }

    if (!callAnswered) {
      console.log('⚠️ Nenhum contato atendeu!');
      
      for (const contact of contatos) {
        const message = `⚠️ ÚLTIMA TENTATIVA\n\nPor favor, ${contact.name}, verifique *${patient.name}* URGENTEMENTE!\n\n📍 ${googleMapsLink}\n\nRESPONDA ESTA MENSAGEM! 🙏`;
        await this.twilioService.sendWhatsAppMessage(contact.phone, message);
      }
    }

    const updated = await this.prismaService.fallAlert.update({
      where: { id: alertId },
      data: { status: 'CONFIRMED' },
    });

    const payload = {
      id: updated.id,
      patientId: updated.patientId,
      status: updated.status,
    };

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
