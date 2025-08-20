import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class PairingCodeDto {
  @ApiProperty({
    description: 'Número de telefone para gerar código de pareamento',
    example: '5511999999999',
    pattern: '^[0-9]{10,13}$'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{10,13}$/, {
    message: 'Telefone deve conter apenas números (10-13 dígitos)'
  })
  phone: string;
}