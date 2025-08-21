import { IsEmail, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ 
    description: 'Email do usuário cuidador', 
    example: 'cuidador@example.com',
    format: 'email'
  })
  @IsEmail()
  email: string;

  @ApiProperty({ 
    description: 'Senha do usuário', 
    example: 'minhasenha123',
    minLength: 1
  })
  @IsString()
  password: string;
}
