import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;
  private readonly fromEmail: string;
  private readonly fromName: string;
  private isConnected: boolean = false;

  constructor(private readonly configService: ConfigService) {
    this.fromEmail = this.configService.get<string>('SMTP_FROM_EMAIL') || 'noreply@intelisensor.com';
    this.fromName = this.configService.get<string>('SMTP_FROM_NAME') || 'InteliSensor';

    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: parseInt(this.configService.get<string>('SMTP_PORT') || '587'),
      secure: this.configService.get<string>('SMTP_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 10000, // 10 segundos
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });
  }

  async onModuleInit() {
    await this.verifyConnection();
  }

  private async verifyConnection(): Promise<void> {
    try {
      await Promise.race([
        this.transporter.verify(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout na verificação SMTP')), 15000)
        )
      ]);
      
      this.isConnected = true;
      this.logger.log('✅ Conexão SMTP verificada com sucesso!');
    } catch (error) {
      this.isConnected = false;
      this.logger.error('❌ Erro ao verificar conexão SMTP:', error.message);
      this.logger.warn('⚠️  Emails serão logados no console em vez de enviados');
    }
  }

  async sendVerificationCode(email: string, code: string, userName: string): Promise<void> {
    try {
      if (!this.isConnected) {
        this.logger.warn(`⚠️  SMTP desconectado - Código de verificação para ${email}: ${code}`);
        return;
      }

      const emailContent = this.generateVerificationEmailHtml(code, userName);
      
      this.logger.log(`📧 Enviando código de verificação para ${email}: ${code}`);

      const info = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: email,
        subject: '🔐 Verifique seu email - InteliSensor',
        html: emailContent,
        text: `Olá ${userName}!\n\nSeu código de verificação é: ${code}\n\nEste código expira em 10 minutos.`,
      });

      this.logger.log(`✅ Email enviado com sucesso! MessageId: ${info.messageId}`);
      
      if (nodemailer.getTestMessageUrl(info)) {
        this.logger.log(`📬 Preview URL: ${nodemailer.getTestMessageUrl(info)}`);
      }
    } catch (error) {
      this.logger.error(`❌ Erro ao enviar email de verificação: ${error.message}`);
      this.logger.warn(`⚠️  FALLBACK - Código de verificação para ${email}: ${code}`);
    }
  }

  private generateVerificationEmailHtml(code: string, userName: string): string {
    return `${require('./templates/email-code').emailCodeVerificationTemplate(code, userName)}`;
  }

  async sendFamilyInvite(email: string, inviterName: string, patientName: string, inviteCode: string): Promise<void> {
    try {
      if (!this.isConnected) {
        this.logger.warn(`⚠️  SMTP desconectado - Convite não enviado para ${email}`);
        return;
      }

      this.logger.log(`📧 Enviando convite familiar para ${email}`);

      const info = await this.transporter.sendMail({
        from: `"${this.fromName}" <${this.fromEmail}>`,
        to: email,
        subject: `🏥 ${inviterName} convidou você para acompanhar ${patientName} - InteliSensor`,
        html: this.generateFamilyInviteEmail(inviterName, patientName, inviteCode),
        text: `${inviterName} convidou você para acompanhar ${patientName} no InteliSensor.\n\nCódigo de convite: ${inviteCode}`,
      });

      this.logger.log(`✅ Convite enviado! MessageId: ${info.messageId}`);
    } catch (error) {
      this.logger.error(`❌ Erro ao enviar convite: ${error.message}`);
    }
  }

  private generateFamilyInviteEmail(inviterName: string, patientName: string, inviteCode: string): string {
    return `${require('./templates/generateFamilyInviteEmail').emailGenerateFamilyInviteEmail(inviterName, patientName, inviteCode)}`;
  }
}
