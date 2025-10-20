import { IsNotEmpty, IsString, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFallAlertDto {
  @ApiProperty({
    description: 'Número de série do dispositivo ESP32',
    example: 'ESP32_001',
    type: 'string',
  })
  @IsNotEmpty()
  @IsString()
  serial: string;

  @ApiProperty({
    description: 'Latitude da localização da queda',
    example: -23.5505,
    type: 'number',
  })
  @IsNotEmpty()
  @IsNumber()
  latitude: number;

  @ApiProperty({
    description: 'Longitude da localização da queda',
    example: -46.6333,
    type: 'number',
  })
  @IsNotEmpty()
  @IsNumber()
  longitude: number;
}
