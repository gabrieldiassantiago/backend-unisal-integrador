import { Test, TestingModule } from '@nestjs/testing';
import { EmergencyContactsController } from './emergency-contacts.controller';

describe('EmergencyContactsController', () => {
  let controller: EmergencyContactsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EmergencyContactsController],
    }).compile();

    controller = module.get<EmergencyContactsController>(EmergencyContactsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
