import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { FallAlertsController } from './fall-alerts.controller';
import { FallAlertsService } from './fall-alerts.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFallAlertDto } from './dtos/create-fall-alert.dto';

// Mock do módulo uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid-1234'),
}));

describe('FallAlertsController', () => {
  let controller: FallAlertsController;
  let fallAlertsService: FallAlertsService;
  let prismaService: PrismaService;

  const mockFallAlertsService = {
    createAlert: jest.fn(),
    getAlertsByPatient: jest.fn(),
    markFalseAlarm: jest.fn(),
    markVerifying: jest.fn(),
    confirmAfterVerification: jest.fn(),
    confirmAlert: jest.fn(),
  };

  const mockPrismaService = {
    pushToken: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FallAlertsController],
      providers: [
        {
          provide: FallAlertsService,
          useValue: mockFallAlertsService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<FallAlertsController>(FallAlertsController);
    fallAlertsService = module.get<FallAlertsService>(FallAlertsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createAlert', () => {
    it('deve criar um alerta de queda com sucesso', async () => {
      const createAlertDto: CreateFallAlertDto = {
        serial: 'ESP32_001',
        latitude: -23.5505,
        longitude: -46.6333,
      };

      const mockAlertResponse = {
        id: 'alert-uuid-1',
        deviceId: 'device-uuid-1',
        patientId: 'patient-uuid-1',
        latitude: -23.5505,
        longitude: -46.6333,
        createdAt: new Date(),
        status: 'PENDING',
      };

      mockFallAlertsService.createAlert.mockResolvedValue(mockAlertResponse);

      const result = await controller.createAlert(createAlertDto);

      expect(fallAlertsService.createAlert).toHaveBeenCalledWith(createAlertDto);
      expect(result).toEqual(mockAlertResponse);
      expect(result.status).toBe('PENDING');
    });
  });

  describe('getAlerts', () => {
    it('deve retornar todos os alertas de um paciente', async () => {
      const patientId = 'patient-uuid-1';
      const mockAlerts = [
        {
          id: 'alert-1',
          patientId: patientId,
          status: 'CONFIRMED',
          createdAt: new Date(),
          latitude: -23.5505,
          longitude: -46.6333,
        },
        {
          id: 'alert-2',
          patientId: patientId,
          status: 'FALSE_ALARM',
          createdAt: new Date(),
          latitude: -23.5510,
          longitude: -46.6340,
        },
      ];

      mockFallAlertsService.getAlertsByPatient.mockResolvedValue(mockAlerts);

      const result = await controller.getAlerts(patientId);

      expect(fallAlertsService.getAlertsByPatient).toHaveBeenCalledWith(patientId);
      expect(result).toEqual(mockAlerts);
      expect(result).toHaveLength(2);
    });

    it('deve lançar BadRequestException quando patientId não for fornecido', async () => {
      await expect(controller.getAlerts('')).rejects.toThrow(BadRequestException);
      await expect(controller.getAlerts('')).rejects.toThrow('O ID do paciente é obrigatório');
    });

    it('deve lançar BadRequestException quando patientId for null', async () => {
      await expect(controller.getAlerts(null)).rejects.toThrow(BadRequestException);
    });
  });

  describe('registerPushToken', () => {
    it('deve registrar um token push com sucesso', async () => {
      const mockRequest = {
        user: {
          userId: 'user-uuid-1',
        },
      };

      const token = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

      const mockPushToken = {
        id: 'push-token-id-1',
        userId: 'user-uuid-1',
        token: token,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.pushToken.findUnique.mockResolvedValue(null);
      mockPrismaService.pushToken.upsert.mockResolvedValue(mockPushToken);

      const result = await controller.registerPushToken(mockRequest, token);

      expect(prismaService.pushToken.upsert).toHaveBeenCalledWith({
        where: { token },
        update: {
          userId: 'user-uuid-1',
          updatedAt: expect.any(Date),
        },
        create: {
          userId: 'user-uuid-1',
          token,
        },
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe('Token registrado com sucesso');
      expect(result.data.tokenId).toBe(mockPushToken.id);
    });

    it('deve lançar BadRequestException quando token não for fornecido', async () => {
      const mockRequest = {
        user: {
          userId: 'user-uuid-1',
        },
      };

      await expect(controller.registerPushToken(mockRequest, '')).rejects.toThrow(
        BadRequestException
      );
      await expect(controller.registerPushToken(mockRequest, '')).rejects.toThrow(
        'Token é obrigatório'
      );
    });

    it('deve lançar BadRequestException quando userId não estiver presente', async () => {
      const mockRequest = {
        user: {},
      };

      const token = 'ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]';

      await expect(controller.registerPushToken(mockRequest, token)).rejects.toThrow(
        BadRequestException
      );
      await expect(controller.registerPushToken(mockRequest, token)).rejects.toThrow(
        'Usuário não autenticado'
      );
    });
  });

  describe('markFalseAlarm', () => {
    it('deve marcar um alerta como falso alarme', async () => {
      const alertId = 'alert-uuid-1';
      const caregiverId = 'caregiver-uuid-1';

      const mockResponse = {
        id: alertId,
        caregiverId: caregiverId,
        status: 'FALSE_ALARM',
      };

      mockFallAlertsService.markFalseAlarm.mockResolvedValue(mockResponse);

      const result = await controller.markFalseAlarm(alertId, { caregiverId });

      expect(fallAlertsService.markFalseAlarm).toHaveBeenCalledWith(alertId, caregiverId);
      expect(result.status).toBe('FALSE_ALARM');
    });

    it('deve lançar BadRequestException quando caregiverId não for fornecido', async () => {
      const alertId = 'alert-uuid-1';

      await expect(controller.markFalseAlarm(alertId, { caregiverId: '' })).rejects.toThrow(
        BadRequestException
      );
      await expect(controller.markFalseAlarm(alertId, { caregiverId: '' })).rejects.toThrow(
        'O ID do cuidador é obrigatório'
      );
    });
  });

  describe('markVerifying', () => {
    it('deve marcar que o cuidador está verificando o alerta', async () => {
      const alertId = 'alert-uuid-1';
      const caregiverId = 'caregiver-uuid-1';

      const mockResponse = {
        id: alertId,
        status: 'VERIFYING',
        respondedBy: caregiverId,
        respondedAt: new Date(),
        verificationDeadline: new Date(Date.now() + 120000),
      };

      mockFallAlertsService.markVerifying.mockResolvedValue(mockResponse);

      const result = await controller.markVerifying(alertId, { caregiverId });

      expect(fallAlertsService.markVerifying).toHaveBeenCalledWith(alertId, caregiverId);
      expect(result.status).toBe('VERIFYING');
      expect(result.respondedBy).toBe(caregiverId);
    });

    it('deve lançar BadRequestException quando caregiverId não for fornecido', async () => {
      const alertId = 'alert-uuid-1';

      await expect(controller.markVerifying(alertId, { caregiverId: '' })).rejects.toThrow(
        BadRequestException
      );
    });
  });

  describe('confirmAfterVerification', () => {
    it('deve confirmar alerta após verificação', async () => {
      const alertId = 'alert-uuid-1';
      const caregiverId = 'caregiver-uuid-1';

      const mockResponse = {
        id: alertId,
        patientId: 'patient-uuid-1',
        status: 'CONFIRMED',
      };

      mockFallAlertsService.confirmAfterVerification.mockResolvedValue(mockResponse);

      const result = await controller.confirmAfterVerification(alertId, { caregiverId });

      expect(fallAlertsService.confirmAfterVerification).toHaveBeenCalledWith(
        alertId,
        caregiverId
      );
      expect(result.status).toBe('CONFIRMED');
    });

    it('deve lançar BadRequestException quando caregiverId não for fornecido', async () => {
      const alertId = 'alert-uuid-1';

      await expect(
        controller.confirmAfterVerification(alertId, { caregiverId: '' })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmAlert', () => {
    it('deve confirmar um alerta automaticamente', async () => {
      const alertId = 'alert-uuid-1';

      const mockResponse = {
        id: alertId,
        patientId: 'patient-uuid-1',
        status: 'CONFIRMED',
      };

      mockFallAlertsService.confirmAlert.mockResolvedValue(mockResponse);

      const result = await controller.confirmAlert(alertId);

      expect(fallAlertsService.confirmAlert).toHaveBeenCalledWith(alertId);
      expect(result.status).toBe('CONFIRMED');
    });
  });
});
