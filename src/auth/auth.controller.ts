import { Controller, Post, Patch, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto } from './dtos/login.dto';

interface ResetPasswordDto {
  email: string;
  password: string;
}

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const user = await this.authService.validateUser(loginDto.email, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('E-mail ou senha inválidos.');
    }
    
    return this.authService.login(user);
  }
  //guard
  @Patch('reset-password')

  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto ) {
    return this.authService.resetPassword(resetPasswordDto.email, resetPasswordDto.password);
  }

}
