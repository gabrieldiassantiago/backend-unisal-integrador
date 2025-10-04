// caregiver/dto/emergency-contact.input.ts
import { IsOptional, IsString } from 'class-validator';

export class EmergencyContactInput {
  @IsOptional() @IsString()
  name?: string;

  @IsString()
  phone!: string;

  @IsOptional()
  priority?: number;
}
