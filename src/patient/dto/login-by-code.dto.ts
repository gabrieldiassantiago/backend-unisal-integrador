import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginByCodeDto {
  @ApiProperty({
    description: 'Código único de acesso gerado pelo cuidador',
    example: 'ABC123',
    type: 'string',
    minLength: 6,
    maxLength: 6
  })
  @IsString()
  @IsNotEmpty()
  code: string;
}
