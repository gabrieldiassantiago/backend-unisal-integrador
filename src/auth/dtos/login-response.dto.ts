import { ApiProperty } from '@nestjs/swagger';

export class UserPayloadDto {
  @ApiProperty({ description: 'ID do usuário', example: 'uuid-string' })
  sub: string;

  @ApiProperty({ description: 'Email do usuário', example: 'user@example.com' })
  email: string;

  @ApiProperty({ description: 'Papel do usuário', example: 'CAREGIVER', enum: ['CAREGIVER'] })
  role: string;

  @ApiProperty({ description: 'Nome do usuário', example: 'João Silva' })
  name: string;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'Token JWT de acesso', example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  access_token: string;

  @ApiProperty({ description: 'Dados do usuário logado', type: UserPayloadDto })
  user: UserPayloadDto;
}
