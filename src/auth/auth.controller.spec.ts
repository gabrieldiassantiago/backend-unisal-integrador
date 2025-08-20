import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UnauthorizedException } from '@nestjs/common';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  beforeEach(() => {
    authService = {
      validateUser: jest.fn(),
      login: jest.fn(),
      resetPassword: jest.fn(),
    } as any;
    controller = new AuthController(authService);
  });

  describe('login', () => {
    it('deve retornar token ao login válido', async () => {
      const user = { id: '1', email: 'a@a.com' };
      (authService.validateUser as jest.Mock).mockResolvedValue(user);
      (authService.login as jest.Mock).mockResolvedValue({ accessToken: 'token' });

      const result = await controller.login({ email: 'a@a.com', password: '123' });
      expect(result).toEqual({ accessToken: 'token' });
      expect(authService.validateUser).toHaveBeenCalledWith('a@a.com', '123');
    });

    it('deve lançar UnauthorizedException se usuário inválido', async () => {
      (authService.validateUser as jest.Mock).mockResolvedValue(null);

      await expect(
        controller.login({ email: 'x@x.com', password: 'errado' })
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});