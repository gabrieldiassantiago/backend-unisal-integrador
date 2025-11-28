import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateEmergencyContactDto } from './dtos/CreateEmergencyContactDto';
import { ContactExistError } from '@src/errors/contactExistError';
import { UpdateEmergencyContactDto } from './dtos/UpdateEmergencyContactDto';

@Injectable()
export class EmergencyContactsService {

  constructor(private readonly prismaService: PrismaService) { }

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

    if (contactExists) {
      throw new Error('Contato já existe');
    }


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

  async getContactsByPatient(patientId: string) {
    return this.prismaService.emergencyContact.findMany({
      where: { patientId }
    })
  }

  async deleteContact(contactId: string) {
    return this.prismaService.$transaction(async (tx) => {
      const contactToDelete = await tx.emergencyContact.findUnique({
        where: { id: contactId }
      })

      if (!contactToDelete) {
        throw new Error('Contato não encontrado');
      }
      const deleted = await tx.emergencyContact.delete({
        where: { id: contactId }
      })

      await tx.emergencyContact.updateMany({
        where: {
          patientId: contactToDelete.patientId,
          priority: {
            gt: contactToDelete.priority
          }
        },
        data: {
          priority: {
            decrement: 1
          }
        }
      })

      return deleted
    })
  }

  async updateContact(contactId: string, data: Partial<UpdateEmergencyContactDto>) {

    //se tiver autorização

    return this.prismaService.emergencyContact.update({
      where: { id: contactId },
      data
    })
  }

}
