import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class SendMessageDto {
  @ApiProperty({
    description: 'Número de telefone no formato brasileiro (com ou sem código do país)',
    example: '11999999999',
    pattern: '^[0-9]{10,13}$'
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{10,13}$/, {
    message: 'Telefone deve conter apenas números (10-13 dígitos)'
  })
  phone: string;

  @ApiProperty({
    description: 'Mensagem a ser enviada via WhatsApp',
    example: 'Olá! Esta é uma mensagem de teste.'
  })
  @IsString()
  @IsNotEmpty()
  message: string;
}