import { IsEmail, IsNotEmpty, IsString, IsOptional, IsBoolean } from 'class-validator';

export class InviteFamilyMemberDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsOptional()
  ttlHours?: number; // Tempo de vida do código (default: 48h)
  
  // Permissões iniciais
  @IsOptional()
  @IsBoolean()
  canViewAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  canRespondAlerts?: boolean;

  @IsOptional()
  @IsBoolean()
  canViewProfile?: boolean;

  @IsOptional()
  @IsBoolean()
  canEditProfile?: boolean;

  @IsOptional()
  @IsBoolean()
  canManageContacts?: boolean;

  @IsOptional()
  @IsBoolean()
  canInviteFamily?: boolean;
}