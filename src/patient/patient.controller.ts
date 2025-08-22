import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { PatientService } from './patient.service';
import { LoginByCodeDto } from './dto/login-by-code.dto';
import { LoginResponseDto } from './dto/login-response-dto';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';
import { PatientProfileDto } from './dto/patient-profile.dto';

@ApiTags('Pacientes')
@Controller('patient')
export class PatientController {
  constructor(private svc: PatientService) {}

  // login via código único
  @Post('login-with-code')
  @ApiOperation({ summary: 'Login via código único (envia código e recebe token + patient)' })
  @ApiBody({ type: LoginByCodeDto })
  @ApiCreatedResponse({
    description: 'Token JWT e dados básicos do paciente',
    type: LoginResponseDto,
  })
  @ApiBadRequestResponse({ description: 'Código inválido / dados faltando' })
  login(@Body() dto: LoginByCodeDto): Promise<LoginResponseDto> {
    return this.svc.loginByCode(dto.code);
  }

  // retorna dados do paciente logado
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Retorna dados do paciente logado' })
  @ApiOkResponse({
    description: 'Perfil do paciente',
    type: PatientProfileDto,
  })
  @ApiUnauthorizedResponse({ description: 'Token inválido ou ausente' })
  getProfile(@Request() req): Promise<PatientProfileDto> {
    return this.svc.getProfilePatient(req.user.userId);
  }
}
