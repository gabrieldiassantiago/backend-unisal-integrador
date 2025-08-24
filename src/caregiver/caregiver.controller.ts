// caregiver/caregiver.controller.ts
import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@src/auth/jwt-auth.guard';
import { CurrentUserId } from '@src/common/decorators/current-user-id.decorator';
import { CaregiverService } from './caregiver.service';
import { CreatePatientAndPairDto } from './dto/create-patient.dto';

@ApiTags('Caregiver')
@ApiBearerAuth()
@Controller('caregiver')
@UseGuards(JwtAuthGuard)
export class CaregiverController {
  constructor(private svc: CaregiverService) {}

  @Post('patients/with-device')
  @ApiOperation({ summary: 'Criar paciente (+birthDate/gender), contatos (1..N), parear device (obrigatório) e gerar código de login' })
  @ApiBody({ type: CreatePatientAndPairDto })
  @ApiResponse({ status: 201, description: 'Tudo criado em transação única' })
  createPatientAndPair(
    @CurrentUserId() userId: string,
    @Body() dto: CreatePatientAndPairDto,
  ) {
    return this.svc.createPatientPairDeviceAndLoginCode(userId, dto);
  }
}
