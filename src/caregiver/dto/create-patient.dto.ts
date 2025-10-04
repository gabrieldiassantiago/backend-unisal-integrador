// caregiver/dto/create-patient-and-pair.dto.ts
import { IsISO8601, IsEnum, IsString, IsOptional, IsArray, ArrayMinSize } from 'class-validator';
import { EmergencyContactInput } from './emergency-contact.input';

export enum GenderDto { MALE='MALE', FEMALE='FEMALE', OTHER='OTHER', UNDECLARED='UNDECLARED' }

export class CreatePatientAndPairDto {
  @IsString()
  name!: string;

  @IsOptional() @IsISO8601()
  birthDate?: string; // "YYYY-MM-DD"

  @IsOptional() @IsEnum(GenderDto)
  gender?: GenderDto;

  @IsArray() @ArrayMinSize(1)
  emergencyContacts!: EmergencyContactInput[];

  @IsOptional()
  ttlMinutes?: number;

  // Device OBRIGATÓRIO
  @IsString()
  deviceSerial!: string;

  @IsString()
  deviceApiKey!: string;
}
