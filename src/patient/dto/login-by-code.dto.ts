import { IsNotEmpty, IsString } from 'class-validator';

export class LoginByCodeDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}
