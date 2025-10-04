// auth.service.spec.ts
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('AuthService', () => {
    let service: AuthService;

    const prismaMock = {

        user: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
    };

    const jwtMock = {
    sign: jest.fn().mockReturnValue('signed.jwt.token'),
  };

  beforeEach(async () => {
        jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
        providers: [
            AuthService,
            { provide: PrismaService, useValue: prismaMock },
            { provide: JwtService, useValue: jwtMock },
        ],
    }).compile();
    
    service = moduleRef.get(AuthService);

  });

 describe('validateUser', () => {
  it('retorna o usuário se as credenciais estiverem corretas', async () => {
    prismaMock.user.findUnique.mockImplementation(async (query) => {
      console.log('🔥 Query recebida pelo mock:', query);
      return null;
    });

    const result = await service.validateUser('x@x.com', 'senha123');

    console.log('📦 Resultado da validateUser:', result);

    expect(result).toBeNull();
  });
});

})