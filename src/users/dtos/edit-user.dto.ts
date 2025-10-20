import { IsEmail, IsOptional, IsString, MinLength, IsDateString, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EditUserDto {
  @ApiProperty({ 
    description: 'Nome completo do usuário', 
    example: 'João Silva', 
    required: false 
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ 
    description: 'Email do usuário', 
    example: 'joao@email.com', 
    format: 'email',
    required: false 
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ 
    description: 'Nova senha (será criptografada)', 
    example: 'novasenha123', 
    minLength: 6,
    required: false 
  })
  @IsOptional()
  @MinLength(6, { message: 'Senha deve ter pelo menos 6 caracteres' })
  password?: string;

  @ApiProperty({ 
    description: 'Data de nascimento', 
    example: '1990-05-15',
    required: false 
  })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiProperty({ 
    description: 'Gênero do usuário', 
    enum: ['MALE', 'FEMALE', 'OTHER', 'UNDECLARED'],
    example: 'MALE',
    required: false 
  })
  @IsOptional()
  @IsEnum(['MALE', 'FEMALE', 'OTHER', 'UNDECLARED'], {
    message: 'Gênero deve ser MALE, FEMALE, OTHER ou UNDECLARED'
  })
  gender?: 'MALE' | 'FEMALE' | 'OTHER' | 'UNDECLARED';
}
