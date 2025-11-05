import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class DeviceHeartbeatDto {
  @IsString()
  serial: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  batteryLevel?: number; // 0-100%

  @IsOptional()
  @IsNumber()
  signalStrength?: number; // RSSI em dBm (ex: -70)

  @IsOptional()
  @IsString()
  firmwareVersion?: string;

  @IsOptional()
  @IsString()
  ipAddress?: string;
}
