// src/auth/dtos/patient-code-login.dto.ts
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class PatientCodeLoginDto {
  @IsString()
  @IsNotEmpty()
  @Length(4, 16) // ajuste conforme formato do seu código
  code!: string;
}
