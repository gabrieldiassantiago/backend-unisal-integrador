import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { PatientService } from './patient.service';
import { LoginByCodeDto } from './dto/login-by-code.dto';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { LoginResponseDto } from './dto/login-response-dto';
import { PatientProfileDto } from './dto/patient-profile.dto';

@ApiTags('Paciente')
@Controller('patient')
export class PatientController {
  constructor(private svc: PatientService) {}

  // login via código único
  @Post('login-with-code')
  @ApiOperation({ summary: 'Login via código único' })
  @ApiBody({ type: LoginByCodeDto })
  @ApiResponse({
    status: 201,
    description: 'Token JWT e dados básicos do paciente',
    type: LoginResponseDto,
  })
  login(@Body() dto: LoginByCodeDto): Promise<LoginResponseDto> {
    return this.svc.loginByCode(dto.code);
  }

  // retorna dados do paciente logado
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Retorna dados do paciente logado' })
  @ApiResponse({
    status: 200,
    description: 'Perfil do paciente',
    type: PatientProfileDto,
  })
  getProfile(@Request() req): Promise<PatientProfileDto> {
    return this.svc.getProfile(req.user.userId);
  }
}
