import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEmergencyContactDto } from './dtos/CreateEmergencyContactDto';
import { ContactExistError } from '@src/errors/contactExistError';

@Injectable()
export class EmergencyContactsService {
    
    constructor(private readonly prismaService: PrismaService) {}

    async createContact(data: CreateEmergencyContactDto) {
  const patientExists = await this.prismaService.user.findUnique({
    where: { id: data.patientId }
  });

  if (!patientExists || patientExists.role !== 'PATIENT') {
    throw new Error(`Paciente com ID ${data.patientId} não encontrado ou não é paciente.`);
  }

  // verifica duplicidade pelo telefone
  const contactExists = await this.prismaService.emergencyContact.findFirst({
    where: {
      patientId: data.patientId,
      phone: data.phone
    }
  });


  // define prioridade (ex: próximo número baseado em quantos já existem)
  const count = await this.prismaService.emergencyContact.count({
    where: { patientId: data.patientId }
  });

  return this.prismaService.emergencyContact.create({
    data: {
      ...data,
      priority: count + 1
    }
  });
}

}
