import { Injectable, InternalServerErrorException, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Mailgun from 'mailgun.js';
import * as FormData from 'form-data';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private mg: any;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private readonly domain: string;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('MAILGUN_FROM_EMAIL') || 'noreply@sandbox123.mailgun.org';
    this.fromName = this.configService.get<string>('FROM_NAME') || 'InteliSensor';
    this.domain = this.configService.get<string>('MAILGUN_DOMAIN') || 'sandbox123.mailgun.org';

    const mailgun = new Mailgun(FormData as any);
    this.mg = mailgun.client({
      username: 'api',
      key: this.configService.get<string>('MAILGUN_API_KEY'),
    });
  }

  async onModuleInit() {
    if (!this.configService.get<string>('MAILGUN_API_KEY')) {
      this.logger.warn('⚠️  MAILGUN_API_KEY não configurada. O envio de emails pode falhar.');
    }
    this.logger.log('✅ Mailgun Email Service inicializado');
  }

  async sendVerificationCode(email: string, code: string, userName: string): Promise<void> {
    try {
      const emailContent = this.generateVerificationEmailHtml(code, userName);

      this.logger.log(`📧 Enviando código de verificação para ${email}: ${code}`);

      const result = await this.mg.messages.create(this.domain, {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [email],
        subject: '🔐 Verifique seu email - InteliSensor',
        html: emailContent,
        text: `Olá ${userName}!\n\nSeu código de verificação é: ${code}\n\nEste código expira em 10 minutos.`,
      });

      this.logger.log(`✅ Email enviado com sucesso! ID: ${result.id}`);
    } catch (error) {
      this.logger.error(`❌ Erro ao enviar email: ${error.message}`, error.stack);
      this.logger.warn(`⚠️  FALLBACK - Código de verificação para ${email}: ${code}`);

      throw new InternalServerErrorException(`Falha ao entregar email de verificação: ${error.message}`);
    }
  }

  private generateVerificationEmailHtml(code: string, userName: string): string {
    return require('./templates/email-code').emailCodeVerificationTemplate(code, userName);
  }

  async sendFamilyInvite(email: string, inviterName: string, patientName: string, inviteCode: string): Promise<void> {
    try {
      this.logger.log(`📧 Enviando convite familiar para ${email}`);

      const result = await this.mg.messages.create(this.domain, {
        from: `${this.fromName} <${this.fromEmail}>`,
        to: [email],
        subject: `🏥 ${inviterName} convidou você para acompanhar ${patientName} - InteliSensor`,
        html: this.generateFamilyInviteEmail(inviterName, patientName, inviteCode),
        text: `${inviterName} convidou você para acompanhar ${patientName} no InteliSensor.\n\nCódigo de convite: ${inviteCode}`,
      });

      this.logger.log(`✅ Convite enviado! ID: ${result.id}`);
    } catch (error) {
      this.logger.error(`❌ Erro ao enviar convite: ${error.message}`);
    }
  }

  private generateFamilyInviteEmail(inviterName: string, patientName: string, inviteCode: string): string {
    return require('./templates/generateFamilyInviteEmail').emailGenerateFamilyInviteEmail(inviterName, patientName, inviteCode);
  }
}
