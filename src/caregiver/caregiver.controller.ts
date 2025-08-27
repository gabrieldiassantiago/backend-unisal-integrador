// caregiver/caregiver.controller.ts
import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
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
  @ApiOperation({ summary: 'Criar paciente e parear dispositivo' })
  @ApiResponse({ status: 201, description: 'Tudo criado em transação única' })
  createPatientAndPair(
    @CurrentUserId() userId: string,
    @Body() dto: CreatePatientAndPairDto,
  ) {
    return this.svc.createPatientPairDeviceAndLoginCode(userId, dto);
  }

  @Post('patients/:patientId/renew-code')
  @ApiOperation({ summary: 'Gerar novo código de login para paciente já cadastrado' })
  @ApiResponse({ status: 201, description: 'Novo código gerado com sucesso' })
  renewLoginCode(
    @CurrentUserId() userId: string,
    @Param('patientId') patientId: string,
    @Body('ttlMinutes') ttlMinutes?: number, 
  ) {
    return this.svc.renewLoginCode(userId, patientId, ttlMinutes);
  }
}
