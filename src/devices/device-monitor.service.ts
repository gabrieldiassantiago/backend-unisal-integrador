import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DevicesService } from './devices.service';
import { PrismaService } from '@src/prisma/prisma.service';
import { MessagingService } from '@src/messaging/messaging.service';

@Injectable()
export class DeviceMonitorService {
  private readonly logger = new Logger(DeviceMonitorService.name);

  constructor(
    private readonly devicesService: DevicesService,
    private readonly prismaService: PrismaService,
    private readonly messagingService: MessagingService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleDeviceMonitoring() {
    this.logger.log('🔍 Verificando dispositivos offline...');
    
    try {
      const result = await this.devicesService.checkOfflineDevices();
      
      if (result.devicesMarkedOffline > 0) {
        this.logger.warn(
          `⚠️ ${result.devicesMarkedOffline} dispositivo(s) marcado(s) como offline (sem heartbeat)`,
        );
        await this.notifyOfflineDevices(result.offlineDeviceIds || []);
      }

      const activeButOfflineDevices = await this.prismaService.device.findMany({
        where: {
          status: 'ACTIVE',
          isOnline: false, // 
        },
        select: {
          id: true,
          deviceIdentifier: true,
          patientId: true,
          lastHeartbeatAt: true,
          patient: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      if (activeButOfflineDevices.length > 0) {
        this.logger.warn(
          `⚠️ ${activeButOfflineDevices.length} dispositivo(s) ACTIVE mas OFFLINE detectado(s)`,
        );
        
        // Notificar sobre dispositivos ACTIVE que estão offline

        await this.notifyOfflineDevices(activeButOfflineDevices.map(d => d.id));
      } else {
        this.logger.log('✅ Todos os dispositivos ACTIVE estão online');
      }
    } catch (error) {
      this.logger.error('❌ Erro ao verificar dispositivos offline:', error);
    }
  }

  /**
   * Notificar contatos de emergência sobre dispositivos offline
   */
  
  private async notifyOfflineDevices(deviceIds: string[]) {
    if (!deviceIds || deviceIds.length === 0) {
      return;
    }

    this.logger.log(`📲 Notificando sobre ${deviceIds.length} dispositivo(s) offline`);

    for (const deviceId of deviceIds) {
      try {
        // Buscar informações do dispositivo e paciente com contatos de emergência
        const device = await this.prismaService.device.findUnique({
          where: { id: deviceId },
          select: {
            id: true,
            deviceIdentifier: true,
            patientId: true,
            lastHeartbeatAt: true,
            patient: {
              select: {
                id: true,
                name: true,
                contacts: {
                  where: { priority: 1 }, // Apenas contato prioritário
                  orderBy: { priority: 'asc' },
                  take: 1,
                  select: {
                    id: true,
                    name: true,
                    phone: true,
                    priority: true,
                  },
                },
              },
            },
          },
        });

        if (!device || !device.patient) {
          this.logger.warn(`⚠️ Dispositivo ${deviceId} não encontrado ou sem paciente`);
          continue;
        }

        const { patient } = device;

        if (!patient.contacts || patient.contacts.length === 0) {
          this.logger.warn(`⚠️ Paciente ${patient.name} não tem contatos de emergência`);
          continue;
        }

        // Enviar mensagem para o contato prioritário
        const contact = patient.contacts[0];

        const lastSeen = device.lastHeartbeatAt 
          ? new Date(device.lastHeartbeatAt).toLocaleString('pt-BR')
          : 'Nunca';

        const message = `⚠️ *DISPOSITIVO OFFLINE*

        Olá, *${contact.name}*! 👋

        O dispositivo de monitoramento de *${patient.name}* está **offline** há mais de 5 minutos. ⏰

        🔴 *Status:* Sem comunicação
        🆔 *Dispositivo:* ${device.deviceIdentifier}
        📡 *Último sinal:* ${lastSeen}
        📅 *Detectado em:* ${new Date().toLocaleString('pt-BR')}

        📱 *O que fazer:*
        ✅ Verificar se o dispositivo está ligado
        ✅ Verificar se há bateria
        ✅ Verificar conexão Wi-Fi/Internet
        ✅ Verificar se *${patient.name}* está vestindo o dispositivo

        ⚠️ *IMPORTANTE:* Enquanto offline, não será possível detectar quedas! 🚨

        Por favor, verifique o quanto antes! 🙏

        🤖 Sistema InteliSensor`;

        await this.messagingService.sendText(contact.phone, message);
        
        this.logger.log(`✅ Notificação enviada para ${contact.name} (${contact.phone}) sobre ${patient.name}`);

      } catch (error) {
        this.logger.error(`❌ Erro ao notificar sobre dispositivo ${deviceId}:`, error.message);
      }
    }

    this.logger.log(`📲 Processo de notificação concluído!`);
  }
}