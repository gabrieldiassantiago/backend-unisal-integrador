import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class PairDeviceDto {
  @IsUUID()
  userId: string;

  @IsNotEmpty()
  @IsString()
  serial: string;

  @IsNotEmpty()
  @IsString()
  apiKey: string;
}
