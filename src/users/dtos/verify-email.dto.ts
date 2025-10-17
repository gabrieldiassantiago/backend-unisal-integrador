import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ 
    description: 'Email do usuário', 
    example: 'usuario@email.com' 
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ 
    description: 'Código de verificação de 6 dígitos', 
    example: '123456',
    minLength: 6,
    maxLength: 6 
  })
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Código deve ter exatamente 6 dígitos' })
  code: string;
}
