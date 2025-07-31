import { Test, TestingModule } from '@nestjs/testing';
import { FallAlertsController } from './fall-alerts.controller';

describe('FallAlertsController', () => {
  let controller: FallAlertsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FallAlertsController],
    }).compile();

    controller = module.get<FallAlertsController>(FallAlertsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
