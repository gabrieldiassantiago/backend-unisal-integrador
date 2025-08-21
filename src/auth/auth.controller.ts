import { Controller, Post, Patch, Body, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { LoginResponseDto } from './dtos/login-response.dto';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ 
    summary: 'Login de usuário cuidador',
    description: 'Autentica um usuário cuidador e retorna um token JWT' 
  })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Login realizado com sucesso',
    type: LoginResponseDto,
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          sub: 'uuid-do-usuario',
          email: 'user@example.com',
          role: 'CAREGIVER',
          name: 'João Silva'
        }
      }
    }
  })
  @ApiResponse({ 
    status: 401, 
    description: 'Credenciais inválidas',
    schema: {
      example: {
        statusCode: 401,
        message: 'E-mail ou senha inválidos.',
        error: 'Unauthorized'
      }
    }
  })
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    
    return this.authService.login(user);
  }

  @Patch('reset-password')
  @ApiOperation({ 
    summary: 'Resetar senha do usuário',
    description: 'Permite resetar a senha de um usuário existente' 
  })
 
  @ApiResponse({ 
    status: 400, 
    description: 'Usuário não encontrado',
    schema: {
      example: {
        statusCode: 400,
        message: 'Usuário não encontrado',
        error: 'Bad Request'
      }
    }
  })
  async resetPassword(@Body() resetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto.email, resetPasswordDto.password);
  }
}