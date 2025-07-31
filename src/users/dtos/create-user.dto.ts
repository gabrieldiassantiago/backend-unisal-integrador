import { IsEmail, IsNotEmpty, IsString, IsEnum } from 'class-validator';

export enum Role {
  PATIENT = 'PATIENT',
  CAREGIVER = 'CAREGIVER',
}

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsNotEmpty()
  password: string;

  @IsEnum(Role)
  role: Role;
}

