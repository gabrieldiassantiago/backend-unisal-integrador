import { PartialType } from '@nestjs/swagger';
import { CreateEmergencyContactDto } from './CreateEmergencyContactDto';
import { IsNumber, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmergencyContactDto extends PartialType(CreateEmergencyContactDto) {

    @ApiPropertyOptional({
        description: 'Nova prioridade do contato (usado para reordenação)',
        example: 1,
        type: Number
    })
    @IsOptional()
    @IsNumber()
    priority?: number;
}