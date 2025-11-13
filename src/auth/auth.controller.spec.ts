import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mocked-uuid-1234'),
}));

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    validateUser: jest.fn(),
    login: jest.fn(),
    logout: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks(); // Limpa os mocks entre testes
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('deve autenticar o usuario com credenciais validas', async () => {
      const loginDto: LoginDto = {
        email: 'teste@gmail.com',
        password: 'senha123',
      };
      
      const mockUserTest = {
        id: 'user-uuid',
        email: 'teste@gmail.com',
        name: 'Teste Usuario',
        role: 'CAREGIVER',
      };

      const mockLoginResponse = {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          sub: 'user-uuid',
          email: 'teste@gmail.com',
          role: 'CAREGIVER',
          name: 'Teste Usuario',
          sessionId: 'session-uuid',
        },
      };

      // Configura o que os mocks devem retornar
      mockAuthService.validateUser.mockResolvedValue(mockUserTest);
      mockAuthService.login.mockResolvedValue(mockLoginResponse);

      const result = await controller.login(loginDto);

      // Verifica se os métodos foram chamados corretamente
      expect(authService.validateUser).toHaveBeenCalledWith(
        loginDto.email, 
        loginDto.password
      );
      expect(authService.login).toHaveBeenCalledWith(mockUserTest);
      
      // Verifica o resultado
      expect(result).toEqual(mockLoginResponse);
      expect(result.access_token).toBeDefined();
      expect(result.user.email).toBe(loginDto.email);
    });

    it('deve lançar UnauthorizedException com credenciais inválidas', async () => {
      const loginDto: LoginDto = {
        email: 'invalido@gmail.com',
        password: 'senhaerrada',
      };

      // Simula usuário não encontrado
      mockAuthService.validateUser.mockResolvedValue(null);

      // Verifica se lança a exceção correta
      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException
      );
      await expect(controller.login(loginDto)).rejects.toThrow(
        'E-mail ou senha inválidos.'
      );

      expect(authService.validateUser).toHaveBeenCalledWith(
        loginDto.email,
        loginDto.password
      );
      // Login NÃO deve ser chamado se validateUser retornar null
      expect(authService.login).not.toHaveBeenCalled();
    });
  });
});