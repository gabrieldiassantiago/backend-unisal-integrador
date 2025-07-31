import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateEmergencyContactDto {
  @IsUUID()
  patientId: string;

  @IsNotEmpty()
  @IsString()
  name: string;

  @IsNotEmpty()
  @IsString()
  phone: string; // pode validar formato se quiser
}
