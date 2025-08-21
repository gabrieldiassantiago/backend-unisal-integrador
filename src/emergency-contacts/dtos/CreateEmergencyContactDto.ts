import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEmergencyContactDto {
  @ApiProperty({
    description: 'UUID do paciente',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: 'string'
  })
  @IsUUID()
  patientId: string;

  @ApiProperty({
    description: 'Nome do contato de emergência',
    example: 'João Silva',
    type: 'string'
  })
  @IsNotEmpty()
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Telefone do contato (formato brasileiro)',
    example: '+5511999999999',
    type: 'string'
  })
  @IsNotEmpty()
  @IsString()
  phone: string;
}
