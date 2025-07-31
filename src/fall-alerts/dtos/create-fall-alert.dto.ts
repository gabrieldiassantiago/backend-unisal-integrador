import { IsNotEmpty, IsString, IsNumber } from 'class-validator';

export class CreateFallAlertDto {
  @IsNotEmpty()
  @IsString()
  serial: string;

  @IsNotEmpty()
  @IsString()
  apiKey: string;

  @IsNotEmpty()
  @IsNumber()
  latitude: number;

  @IsNotEmpty()
  @IsNumber()
  longitude: number;

  @IsNotEmpty()
  @IsString()
  timestamp: string; // ISO string
}
