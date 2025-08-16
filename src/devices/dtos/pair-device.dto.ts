import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class PairDeviceDto {
  @ApiProperty({
    description: 'ID do usuário',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string',
  })
  @IsUUID()
  userId: string;

  @ApiProperty({
    description: 'Número de série do dispositivo',
    example: 'ESP32_001',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  serial: string;

  @ApiProperty({
    description: 'Chave de API do dispositivo',
    example: '1234567890abcdef',
    type: 'string',
  })
  
  @IsNotEmpty()
  @IsString()
  apiKey: string;
}
