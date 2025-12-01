import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppService } from './app.service';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService,
    private readonly prismaService: PrismaService
  ) { }

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Post('wipe-database') //uso para limpar o banco de dados, apenas para desenvolvimento
  async wipeDataBase(@Body('password') password: string) {

    const masterPassword = process.env.MASTER_PASSWORD;

    if (password !== masterPassword) {
      throw new Error('SENHA INCORRETA');
    }

    await this.prismaService.$transaction([

      this.prismaService.pushToken.deleteMany(),
      this.prismaService.refreshToken.deleteMany(),
      this.prismaService.accessCode.deleteMany(),
      this.prismaService.emailVerification.deleteMany(),

      // 2. Relacionamentos familiares e cuidadores
      this.prismaService.familyPermissions.deleteMany(),
      this.prismaService.familyRelation.deleteMany(),
      this.prismaService.caregiverPatient.deleteMany(),
      this.prismaService.emergencyContact.deleteMany(),

      // 3. Alertas (dependem de device + user + contact)
      this.prismaService.fallAlert.deleteMany(),

      // 4. Devices e Users
      this.prismaService.device.deleteMany(),

      // 5. Usuários por último
      this.prismaService.user.deleteMany(),
    ])

  }


}
