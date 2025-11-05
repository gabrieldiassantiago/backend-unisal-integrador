import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DevicesService } from './devices.service';

@Injectable()
export class DeviceMonitorService {
  private readonly logger = new Logger(DeviceMonitorService.name);

  constructor(private readonly devicesService: DevicesService) {}

  /**
   * Executa a cada 10 segundos para verificar dispositivos offline
   */

  @Cron(CronExpression.EVERY_10_MINUTES)
  async handleDeviceMonitoring() {
    this.logger.log('🔍 Verificando dispositivos offline...');
    
    try {
      const result = await this.devicesService.checkOfflineDevices();
      
      if (result.devicesMarkedOffline > 0) {
        this.logger.warn(
          `⚠️ ${result.devicesMarkedOffline} dispositivo(s) marcado(s) como offline`,
        );
      } else {
        this.logger.log('✅ Todos os dispositivos online estão ativos');
      }
    } catch (error) {
      this.logger.error('❌ Erro ao verificar dispositivos offline:', error);
    }
  }
}
