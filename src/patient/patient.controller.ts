import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { PatientService } from './patient.service';
import { LoginByCodeDto } from './dto/login-by-code.dto';
import { JwtAuthGuard } from '@src/auth/wt-auth.guard';

@Controller('patient')
export class PatientController {
  constructor(private svc: PatientService) {}

  // login via código único
  @Post('login-with-code')
  login(@Body() dto: LoginByCodeDto) {
    return this.svc.loginByCode(dto.code);
  }

  // retorna dados do paciente logado
  @UseGuards(JwtAuthGuard)
  @Get('me')
  getProfile(@Request() req) {
    return this.svc.getProfile(req.user.userId);
  }
}
