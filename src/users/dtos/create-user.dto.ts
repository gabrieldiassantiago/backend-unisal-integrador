import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateUserDto {
  @ApiProperty({ description: 'Nome completo do usuário', example: 'gab dias', minLength: 2 })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({ description: 'Email único para login', example: 'gab@email.com', format: 'email' })
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'Senha do usuário (será criptografada)', example: 'minhasenha123', minLength: 6 })
  @IsNotEmpty()
  @MinLength(6, { message: 'Senha deve ter pelo menos 6 caracteres' })
  password: string;
}
