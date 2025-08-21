import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ContactDto {
  @ApiProperty({ example: 'c1' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'p1' })
  @IsString()
  patientId: string;

  @ApiProperty({ example: 'João' })
  @IsString()
  name: string;

  @ApiProperty({ example: '+55 11 99999-9999' })
  @IsString()
  phone: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  priority: number;
}

export class FallAlertDto {
  @ApiProperty({ example: 'fa1' })
  @IsString()
  id: string;

  @ApiProperty({ example: 'p1' })
  @IsString()
  patientId: string;

  @ApiProperty({
    description: 'Data de criação (ISO string ou Date object)',
    example: '2024-01-01T12:00:00Z',
    required: false,
  })
  @IsOptional()
  createdAt?: string | Date;

  @ApiProperty({ example: 'manual', required: false })
  @IsOptional()
  @IsString()
  confirmationMethod?: string;
}

export class PatientProfileDto {
  @ApiProperty({ description: 'ID do paciente', example: 'p1' })
  @IsString()
  id: string;

  @ApiProperty({ description: 'Nome do paciente', example: 'Maria Silva' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Idade', example: 35 })
  @IsInt()
  age: number;

  @ApiProperty({ description: 'E-mail', example: 'maria@example.com', required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({
    description: 'Data de criação (ISO string ou Date object)',
    example: '2024-01-01T12:00:00Z',
    required: false,
  })
  @IsOptional()
  createdAt?: string | Date;

  @ApiProperty({ type: [ContactDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  contacts?: ContactDto[];

  @ApiProperty({ type: [FallAlertDto], required: false })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FallAlertDto)
  fallAlerts?: FallAlertDto[];
}