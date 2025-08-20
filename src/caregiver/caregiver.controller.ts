import { 
  Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards 
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiParam, ApiBody, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';
import { CaregiverService } from './caregiver.service';
import { CreatePatientDto } from './dto/create-patient.dto';
import { JwtAuthGuard } from '@src/auth/wt-auth.guard';
import { CurrentUserId } from '@src/common/decorators/current-user-id.decorator';

@ApiTags('Caregiver')
@ApiBearerAuth()
@Controller('caregiver')
@UseGuards(JwtAuthGuard)
export class CaregiverController {
  constructor(private svc: CaregiverService) {}

  @Post('patients')
  @ApiOperation({ summary: 'Criar paciente e gerar código de login' })
  @ApiResponse({ status: 201, description: 'Paciente criado com sucesso e código gerado' })
  @ApiUnauthorizedResponse({ description: 'Token ausente ou inválido' })
  @ApiForbiddenResponse({ description: 'Apenas cuidadores podem acessar' })
  @ApiBody({ type: CreatePatientDto })
  createPatient(@CurrentUserId() userId: string, @Body() dto: CreatePatientDto) {
    return this.svc.createPatientAndCode(
      userId,
      dto.name,
      dto.age,
      dto.ttlMinutes,
      dto.emergencyContactPhone,
      dto.emergencyContactName,
    );
  }

  @Post('patients/:patientId/access-code')
  @ApiOperation({ summary: 'Gerar novo código de login para paciente existente' })
  @ApiParam({ name: 'patientId', type: String, format: 'uuid' })
  @ApiBody({ schema: { example: { ttlMinutes: 120 } } })
  @ApiResponse({ status: 201, description: 'Código gerado com sucesso' })
  generateNewCode(
    @CurrentUserId() userId: string,
    @Param('patientId', new ParseUUIDPipe()) patientId: string,
    @Body('ttlMinutes') ttlMinutes?: number,
  ) {
    return this.svc.generateAccessCodeForPatient(userId, patientId, ttlMinutes);
  }

  @Get('patients')
  @ApiOperation({ summary: 'Listar pacientes do cuidador' })
  @ApiResponse({ status: 200, description: 'Lista de pacientes vinculados ao cuidador' })
  list(@CurrentUserId() userId: string) {
    return this.svc.myPatients(userId);
  }
}
