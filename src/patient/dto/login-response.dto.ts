import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsOptional, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { PatientProfileDto } from './patient-profile.dto';

export class LoginResponseDto {
  @ApiProperty({ description: 'Token JWT', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6...' })
  @IsString()
  accessToken: string;

  @ApiProperty({ description: 'Segundos até expiração do token', example: 3600, required: false })
  @IsOptional()
  expiresIn?: number;

  @ApiProperty({ description: 'Dados do paciente autenticado', type: () => PatientProfileDto })
  @ValidateNested()
  @Type(() => PatientProfileDto)
  patient: PatientProfileDto;
}