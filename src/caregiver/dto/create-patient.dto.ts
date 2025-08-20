import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min, Matches } from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class CreatePatientDto {
  @ApiProperty({ example: 'João da Silva' })
  @IsString() @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 75, minimum: 0, maximum: 130 })
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(130)
  age?: number;

  @ApiPropertyOptional({ example: 60, description: 'Tempo de expiração do código em minutos (1-1440)' })
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(1440)
  ttlMinutes?: number;

  @ApiProperty({ example: '+5511999999999', description: 'Telefone do contato de emergência' })
  @IsString() @IsNotEmpty()
  @Matches(/^\+?\d{10,15}$/, { message: 'Telefone inválido' })
  @Transform(({ value }) => {
    if (typeof value !== 'string') return value;
    const v = value.trim();
    return v.startsWith('+') ? '+' + v.slice(1).replace(/\D/g, '') : v.replace(/\D/g, '');
  })
  emergencyContactPhone: string;

  @ApiPropertyOptional({ example: 'Maria Silva' })
  @IsOptional() @IsString()
  emergencyContactName?: string;
}
