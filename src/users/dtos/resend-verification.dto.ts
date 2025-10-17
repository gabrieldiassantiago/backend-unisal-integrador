import { IsEmail, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResendVerificationDto {
  @ApiProperty({ 
    description: 'Email para reenviar código', 
    example: 'usuario@email.com' 
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
