import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateFallAlertDto } from './dtos/create-fall-alert.dto';
import * as bcrypt from 'bcrypt';
import { WhatsAppService } from 'src/whatsapp/whatsapp.service';

@Injectable()
export class FallAlertsService {
    constructor(private readonly prismaService: PrismaService, 
        private whatsappService: WhatsAppService, 
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

    async confirmAlert(alertId: string) { //refatorar isso o quanto antes
        
    const alert = await this.prismaService.fallAlert.findUnique({
        where: { id: alertId },
    });

    const patient = await this.prismaService.user.findUnique({
        where: { id: alert.patientId },
    });

    if (!alert) {
        throw new Error('Alerta não encontrado.');
    }

    const contatos = await this.prismaService.emergencyContact.findMany({
        where: { patientId: alert.patientId },
        select: { phone: true, name: true }
    });

    if (contatos.length === 0) {
        throw new Error('Nenhum contato de emergência encontrado para o paciente.');
    }

    for (const contact of contatos) {
        try {
        await this.whatsappService.enviarTexto(
            contact.phone, 
            `Alerta de queda confirmado para o paciente ${patient.name}. Por favor, verifique o bem-estar dele.`
        );
        } catch (error) {
        console.error(`Erro ao enviar mensagem para o contato ${contact.name}:`, error);
        }
    }

    return this.prismaService.fallAlert.update({
        where: { id: alertId },
        data: { status: 'CONFIRMED' }
    });
    
}

}
