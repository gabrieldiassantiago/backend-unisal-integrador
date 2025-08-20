import { ApiProperty } from '@nestjs/swagger';
import { Role } from 'generated/prisma';

export class UserResponseDto {
  @ApiProperty({ description: 'ID único do usuário' })
  id: string;

  @ApiProperty({ description: 'Nome completo do usuário' })
  name: string;

  @ApiProperty({ description: 'Email do usuário' })
  email: string;

  @ApiProperty({ description: 'Papel do usuário no sistema', enum: Role, example: Role.CAREGIVER })
  role: Role;

  @ApiProperty({ description: 'Se o usuário já ativou a conta' })
  hasAccount: boolean;

  @ApiProperty({ description: 'Data de criação da conta' })
  createdAt: Date;
}
