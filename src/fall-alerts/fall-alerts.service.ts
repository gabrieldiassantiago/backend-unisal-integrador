import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateFallAlertDto } from './dtos/create-fall-alert.dto';
import * as bcrypt from 'bcrypt';
import { WhatsAppService } from 'src/whatsapp/whatsapp.service';

@Injectable()
export class FallAlertsService {
    constructor(private readonly prismaService: PrismaService, 
        private whatsappService: WhatsAppService, // Assuming you have a WhatsApp service to send messages
    ) {
        this.whatsappService = whatsappService;
    }

    async createAlert(data: CreateFallAlertDto) {
        const device = await this.prismaService.device.findUnique({
            where: {
                deviceIdentifier: data.serial
            }
        })

        if (!device) {
            throw new Error(`Dispositivo com serial ${data.serial} não encontrado.`);
        }

        const isValidApiKey = await bcrypt.compare(data.apiKey, device.apiKeyHash);

        if (!isValidApiKey) {
            throw new Error('Chave de API inválida.');
        }

        const alert = await this.prismaService.fallAlert.create({
            data: {
                deviceId: device.id,
                latitude: data.latitude,
                longitude: data.longitude,
                createdAt: new Date(data.timestamp),
                status: 'PENDING',
                patientId: device.userId, 
            }
        });

        const contacts = await this.prismaService.emergencyContact.findMany({
            where: {
                patientId: device.userId
            }
        })

        for (const contact of contacts) {
            await this.whatsappService.enviarTexto(
                contact.phone,
                `Alerta de queda detectado para ${device.userId}. Localização: ${data.latitude}, ${data.longitude}`
            );
        }
        
        return {
            id: alert.id,
            deviceId: alert.deviceId,
            latitude: alert.latitude,
            longitude: alert.longitude,
            createdAt: alert.createdAt,
            status: alert.status,
            patientId: alert.patientId
        };
    }
      async getAlertsByPatient(patientId: string) {
    return this.prismaService.fallAlert.findMany({
      where: { patientId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async confirmAlert(alertId: string) {
    return this.prismaService.fallAlert.update({
      where: { id: alertId },
        data: { status: 'CONFIRMED' }
    });
  }
}
