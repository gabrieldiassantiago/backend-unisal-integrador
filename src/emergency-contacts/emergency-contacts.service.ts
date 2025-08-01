import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEmergencyContactDto } from './dtos/CreateEmergencyContactDto';

@Injectable()
export class EmergencyContactsService {
    
    constructor(private readonly prismaService: PrismaService) {}

    async createContact(data: CreateEmergencyContactDto) {
        const patientExists = await this.prismaService.user.findUnique({
            where: {
                id: data.patientId
            }
        })

        if (!patientExists) {
            throw new NotFoundException(`Paciente com ID ${data.patientId} não encontrado.`);
        }

        return this.prismaService.emergencyContact.create({
            data
        })
    }
}
