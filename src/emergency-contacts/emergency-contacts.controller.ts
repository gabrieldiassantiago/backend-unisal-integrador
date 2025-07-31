import { Body, Controller, Post } from '@nestjs/common';
import { EmergencyContactsService } from './emergency-contacts.service';
import { CreateEmergencyContactDto } from './dtos/CreateEmergencyContactDto';

@Controller('emergency-contacts')
export class EmergencyContactsController {
    constructor(private readonly emergencyContactsService: EmergencyContactsService) {}

     @Post()
  async create(@Body() data: CreateEmergencyContactDto) {
    return this.emergencyContactsService.createContact(data);
  }
}
