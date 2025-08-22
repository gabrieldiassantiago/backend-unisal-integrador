
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { ExistingEmailError } from '../../src/errors/existingUserError';
import * as bcrypt from 'bcrypt';

const mockPrismaService = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deve ser definido', () => {
    expect(service).toBeDefined();
  });

  describe('createUser', () => {
    it('deve criar um novo usuário', async () => {
      const createUserDto = {
        name: 'Usuário de Teste',
        email: 'teste@exemplo.com',
        password: 'senha123',
      };
      const hashedPassword = 'senhaCriptografada';
      const createdUser = {
        id: '1',
        name: 'Usuário de Teste',
        email: 'teste@exemplo.com',
        role: 'CAREGIVER',
        hasAccount: true,
        createdAt: new Date(),
      };

      (bcrypt.hash as jest.Mock) = jest.fn().mockResolvedValue(hashedPassword);
      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.user.create.mockResolvedValue(createdUser);

      const result = await service.createUser(createUserDto);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { email: createUserDto.email },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith(createUserDto.password, 10);
      expect(mockPrismaService.user.create).toHaveBeenCalledWith({
        data: {
          name: createUserDto.name,
          email: createUserDto.email,
          password: hashedPassword,
          role: 'CAREGIVER',
          hasAccount: true,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          hasAccount: true,
          createdAt: true,
        },
      });
      expect(result).toEqual(createdUser);
    });

    it('deve lançar um erro se o email já existir', async () => {
      const createUserDto = {
        name: 'Usuário de Teste',
        email: 'teste@exemplo.com',
        password: 'senha123',
      };

      mockPrismaService.user.findUnique.mockResolvedValue({ id: '1' });

      await expect(service.createUser(createUserDto)).rejects.toThrow(
        new ExistingEmailError(
          `Usuário com o email ${createUserDto.email} já existe`,
        ),
      );
    });
  });

  describe('getAllUsers', () => {
    it('deve retornar um array de usuários', async () => {
      const users = [
        { id: '1', name: 'Usuário 1' },
        { id: '2', name: 'Usuário 2' },
      ];
      mockPrismaService.user.findMany.mockResolvedValue(users);

      const result = await service.getAllUsers();

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        include: {
          devices: true,
          fallAlerts: true,
          contacts: true,
          caregivers: true,
          patients: true,
        },
      });
      expect(result).toEqual(users);
    });
  });

  describe('getUserProfile', () => {
    it('deve retornar o perfil de um usuário', async () => {
      const userId = '1';
      const userProfile = {
        id: userId,
        name: 'Usuário de Teste',
        email: 'teste@exemplo.com',
      };
      mockPrismaService.user.findUnique.mockResolvedValue(userProfile);

      const result = await service.getUserProfile(userId);

      expect(mockPrismaService.user.findUnique).toHaveBeenCalledWith({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          hasAccount: true,
          createdAt: true,
          devices: true,
          fallAlerts: true,
          contacts: true,
          patients: {
            select: {
              id: true,
              patient: true,
            },
          },
        },
      });
      expect(result).toEqual(userProfile);
    });
  });
});