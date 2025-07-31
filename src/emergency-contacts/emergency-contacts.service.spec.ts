import { Test, TestingModule } from '@nestjs/testing';
import { EmergencyContactsService } from './emergency-contacts.service';

describe('EmergencyContactsService', () => {
  let service: EmergencyContactsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmergencyContactsService],
    }).compile();

    service = module.get<EmergencyContactsService>(EmergencyContactsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
