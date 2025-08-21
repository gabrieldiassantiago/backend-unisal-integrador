import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class LoginByCodeDto {
  @ApiProperty({
    description: 'Código único entregue ao paciente para login',
    example: 'ABC123XYZ',
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}