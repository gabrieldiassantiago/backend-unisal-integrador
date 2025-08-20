import { Body, ConflictException, Controller, Post } from '@nestjs/common';
import { EmergencyContactsService } from './emergency-contacts.service';
import { CreateEmergencyContactDto } from './dtos/CreateEmergencyContactDto';
import { ContactExistError } from '@src/errors/contactExistError';

@Controller('emergency-contacts')
export class EmergencyContactsController {
constructor(private readonly emergencyContactsService: EmergencyContactsService) {}

     @Post()
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
}
