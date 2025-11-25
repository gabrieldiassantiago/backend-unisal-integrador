import { Body, ConflictException, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiConflictResponse } from '@nestjs/swagger';
import { EmergencyContactsService } from './emergency-contacts.service';
import { CreateEmergencyContactDto } from './dtos/CreateEmergencyContactDto';
import { ContactExistError } from '@src/errors/contactExistError';

@ApiTags('Contatos de Emergência')
@Controller('emergency-contacts')
export class EmergencyContactsController {
  constructor(private readonly emergencyContactsService: EmergencyContactsService) { }

  @Post()
  @ApiOperation({
    summary: 'Criar contato de emergência',
    description: 'Cria um novo contato de emergência para um usuário'
  })
  @ApiBody({ type: CreateEmergencyContactDto })
  @ApiResponse({
    status: 201,
    description: 'Contato de emergência criado com sucesso',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        name: { type: 'string', example: 'João Silva' },
        phone: { type: 'string', example: '+5511999999999' },
        userId: { type: 'string', example: '123e4567-e89b-12d3-a456-426614174000' },
        createdAt: { type: 'string', format: 'date-time' }
      }
    }
  })
  @ApiConflictResponse({
    description: 'Contato já existe para este usuário',
    schema: {
      example: {
        statusCode: 409,
        message: 'Contato já existe',
        error: 'Conflict'
      }
    }
  })
  async create(@Body() data: CreateEmergencyContactDto) {
    try {
      return this.emergencyContactsService.createContact(data);
    } catch (error) {
      if (error instanceof ContactExistError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Get(':patientId')
  async getContactsByPatient(@Param('patientId') patientId: string) {
    return this.emergencyContactsService.getContactsByPatient(patientId);
  }
}
