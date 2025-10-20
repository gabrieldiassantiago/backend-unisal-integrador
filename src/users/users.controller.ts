import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Patch,
  UseGuards,
  Request,
  Param,
} from '@nestjs/common';
import {
  ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiParam,
} from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CreateUserDto } from './dtos/create-user.dto';
import { UserResponseDto } from './dtos/user-response.dto';
import { UserWithRelationsDto } from './dtos/user-with-relations.dto';
import { VerifyEmailDto } from './dtos/verify-email.dto';
import { ResendVerificationDto } from './dtos/resend-verification.dto';
import { EditUserDto } from './dtos/edit-user.dto';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';

@ApiTags('Usuários')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar cuidador',
    description: 'Inicia o processo de cadastro enviando código de verificação por email. O usuário só será criado após verificar o código.',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: 'Código de verificação enviado por email.', 
    schema: {
      example: {
        message: 'Código de verificação enviado para seu email. Verifique seu email para completar o cadastro.',
        email: 'usuario@email.com',
        expiresIn: '10 minutos'
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email já está em uso',
    schema: { example: { statusCode: 409, message: 'Usuário com o email x@y.com já existe', error: 'Conflict' } },
  })
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.createUser(dto);
  }

  @Post('verify-email')
  @ApiOperation({
    summary: 'Verificar email e criar conta',
    description: 'Verifica o código de 6 dígitos enviado por email e cria a conta do usuário',
  })
  @ApiBody({ type: VerifyEmailDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Email verificado e conta criada com sucesso',
    schema: {
      example: {
        message: 'Email verificado com sucesso! Sua conta foi criada. Agora você pode fazer login.',
        verified: true,
        user: {
          id: 'uuid',
          name: 'João Silva',
          email: 'joao@email.com',
          role: 'CAREGIVER',
          hasAccount: true,
          emailVerified: true,
          createdAt: '2025-10-16T...'
        }
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Código inválido ou expirado',
  })
  async verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.usersService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @ApiOperation({
    summary: 'Reenviar código de verificação',
    description: 'Reenvia o código de verificação para o email fornecido',
  })
  @ApiBody({ type: ResendVerificationDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Novo código enviado',
    schema: {
      example: {
        message: 'Novo código enviado para seu email',
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Usuário não encontrado ou email já verificado',
  })
  async resendVerification(@Body() dto: ResendVerificationDto) {
    return this.usersService.resendVerificationCode(dto.email);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get()
  @ApiOperation({ summary: 'Listar todos os usuários', description: 'Retorna todos os usuários com relações' })
  @ApiResponse({ status: HttpStatus.OK, type: [UserWithRelationsDto] })
  async findAll(): Promise<UserWithRelationsDto[]> {
    return this.usersService.getAllUsers();
  }

  // IMPORTANTE: "me" vem antes de ":id" para não conflitar
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Perfil do usuário autenticado' })
  @ApiResponse({ status: HttpStatus.OK, type: UserWithRelationsDto })
  async getUserProfile(@Request() req): Promise<UserWithRelationsDto | null> {
    return this.usersService.getUserProfile(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Buscar usuário por ID', description: 'Retorna um usuário com relações' })
  @ApiParam({ name: 'id', description: 'UUID do usuário' })
  @ApiResponse({ status: HttpStatus.OK, type: UserWithRelationsDto })
  async findOne(@Param('id') id: string): Promise<UserWithRelationsDto | null> {
    return this.usersService.getUserProfile(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch('me')
  @ApiOperation({ 
    summary: 'Editar perfil do usuário autenticado',
    description: 'Permite ao usuário editar apenas seu próprio perfil. Se o email for alterado, um código de verificação será enviado.'
  })
  @ApiBody({ type: EditUserDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usuário atualizado com sucesso',
    schema: {
      example: {
        message: 'Usuário atualizado com sucesso!',
        user: {
          id: 'uuid',
          name: 'João Silva Atualizado',
          email: 'joao.novo@email.com',
          role: 'CAREGIVER',
          birthDate: '1990-05-15T00:00:00.000Z',
          gender: 'MALE',
          hasAccount: true,
          emailVerified: false,
          createdAt: '2025-10-16T...'
        },
        emailChanged: true
      }
    }
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Usuário não encontrado'
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email já está em uso'
  })
  async updateMyProfile(@Request() req, @Body() dto: EditUserDto) {
    return this.usersService.editUser(req.user.userId, dto);
  }
}
