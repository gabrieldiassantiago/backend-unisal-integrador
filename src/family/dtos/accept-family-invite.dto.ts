import { IsString, IsNotEmpty, MinLength } from 'class-validator';

export class AcceptFamilyInviteDto {
  @IsString()
  @IsNotEmpty({ message: 'Código de convite é obrigatório' })
  inviteCode: string;

  @IsString()
  @IsNotEmpty({ message: 'Senha é obrigatória' })
  @MinLength(6, { message: 'Senha deve ter pelo menos 6 caracteres' })
  password: string;
}