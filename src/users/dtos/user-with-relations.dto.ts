import { ApiProperty } from '@nestjs/swagger';
import { UserResponseDto } from './user-response.dto';

class DeviceDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  deviceIdentifier: string;

  @ApiProperty({ enum: ['PENDING', 'ACTIVE', 'INACTIVE'] })
  status: string;

  @ApiProperty({ required: false })
  firmwareVersion?: string;

  @ApiProperty()
  registeredAt: Date;

  @ApiProperty({ required: false })
  pairedAt?: Date;

  @ApiProperty({ required: false })
  lastSeenAt?: Date;
}


class EmergencyContactDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() phone: string;
}

class FallAlertDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ['PENDING', 'CONFIRMED', 'IGNORED'] }) status: string;
  @ApiProperty() latitude: number;
  @ApiProperty() longitude: number;
  @ApiProperty() createdAt: Date;
  @ApiProperty({ required: false }) location?: string;
}

export class UserWithRelationsDto extends UserResponseDto {
  @ApiProperty({ description: 'Dispositivos associados ao usuário', type: [DeviceDto] })
  devices: DeviceDto[];

  @ApiProperty({ description: 'Contatos de emergência do usuário', type: [EmergencyContactDto] })
  contacts: EmergencyContactDto[];

  @ApiProperty({ description: 'Alertas de queda do usuário', type: [FallAlertDto] })
  fallAlerts: FallAlertDto[];
}
