import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
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
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';

@ApiTags('Usuários')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @ApiOperation({
    summary: 'Criar cuidador',
    description: 'Cria um novo usuário cuidador (CARE­GIVER) com senha criptografada',
  })
  @ApiBody({ type: CreateUserDto })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Usuário criado com sucesso', type: UserResponseDto })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    description: 'Email já está em uso',
    schema: { example: { statusCode: 409, message: 'User with email x@y.com already exists', error: 'Conflict' } },
  })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.createUser(dto);
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
}
