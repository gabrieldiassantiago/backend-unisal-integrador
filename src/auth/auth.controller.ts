import { Controller, Post, Body, UnauthorizedException, UseGuards, HttpCode, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';
import { LoginResponseDto } from './dtos/login-response.dto';
import { FamilyMemberLoginDto } from './dtos/family-member-login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LocalAuthGuard } from './local-auth.guard';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({
    summary: 'Login de usuário cuidador',
    description: 'Autentica um usuário cuidador e retorna um token JWT',
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
          name: 'João Silva',
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciais inválidas',
    schema: {
      example: {
        statusCode: 401,
        message: 'E-mail ou senha inválidos.',
        error: 'Unauthorized',
      },
    },
  })
  @UseGuards(LocalAuthGuard)
  async login(@Request() req, @Body() loginDto: LoginDto) {
    return this.authService.login(req.user);
  }

  @Post('family/login')
  @ApiOperation({
    summary: 'Login de familiar',
    description: 'Autentica um usuário familiar e retorna um token JWT com permissões específicas',
  })
  @ApiBody({ type: FamilyMemberLoginDto })
  @ApiResponse({
    status: 200,
    description: 'Login realizado com sucesso',
    schema: {
      example: {
        access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        user: {
          sub: 'uuid-do-familiar',
          email: 'familiar@example.com',
          role: 'FAMILY_MEMBER',
          name: 'Maria Silva',
          patientAccess: [
            {
              patientId: 'uuid-do-paciente',
              patientName: 'João Idoso',
              permissions: {
                canViewAlerts: true,
                canRespondAlerts: false,
                canViewProfile: true,
                canEditProfile: false,
                canManageContacts: false,
                canInviteFamily: false,
              },
            },
          ],
        },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Credenciais inválidas',
    schema: {
      example: {
        statusCode: 401,
        message: 'E-mail ou senha inválidos.',
        error: 'Unauthorized',
      },
    },
  })
  @UseGuards(LocalAuthGuard)
  async familyLogin(@Request() req, @Body() loginDto: FamilyMemberLoginDto) {
    return this.authService.login(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Request() req,
    @Body() body: { pushToken?: string },
  ) {
    const userId = req.user.userId || req.user.sub || req.user.id;
    await this.authService.logout(userId, body.pushToken);
    return { message: 'Logout realizado com sucesso' };
  }
}
