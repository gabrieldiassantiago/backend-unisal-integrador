import { IsNumber, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class GeocodeDto {
  @ApiProperty({
    description: 'Latitude',
    example: -23.5505,
  })
  @IsNumber()
  @IsNotEmpty()
  latitude: number;

  @ApiProperty({
    description: 'Longitude',
    example: -46.6333,
  })
  @IsNumber()
  @IsNotEmpty()
  longitude: number;
}
