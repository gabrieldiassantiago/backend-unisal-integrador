import { Test, TestingModule } from '@nestjs/testing';
import { FallAlertsService } from './fall-alerts.service';

describe('FallAlertsService', () => {
  let service: FallAlertsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [FallAlertsService],
    }).compile();

    service = module.get<FallAlertsService>(FallAlertsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
