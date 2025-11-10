import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

@Injectable()
export class MessagingService {
  private readonly logger = new Logger(MessagingService.name);
  private httpClient: AxiosInstance;
  private readonly apiKey = 'B0F1888ADAE4-4C72-B849-B12709F80913';
  private readonly baseUrl = 'http://104.248.184.126:8080';

  constructor() {
    // Criar cliente HTTP com configurações
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'apiKey': this.apiKey,
        'Content-Type': 'application/json',
      },
    });

    this.logger.log('✅ Messaging Service inicializado');
    this.logger.log(`📡 Base URL: ${this.baseUrl}`);
  }

  /**
   * Enviar mensagem de texto via API
   */
  
  async sendText(to: string, text: string): Promise<any> {
    try {
      // Limpar número (remover caracteres especiais)
      const cleanNumber = to.replace(/\D/g, '');

      this.logger.log(`📤 Enviando mensagem para ${cleanNumber}`);
      this.logger.log(`📝 Texto: ${text.substring(0, 50)}...`);

      const payload = {
        number: cleanNumber,
        text: text,
      };

      const response = await this.httpClient.post('/message/sendText/intelisensor', payload);

      this.logger.log(`✅ Mensagem enviada com sucesso!`);
      this.logger.log(`📊 Response: ${JSON.stringify(response.data)}`);
      
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Erro ao enviar mensagem: ${error.response?.data || error.message}`);
      this.logger.error(`Status Code: ${error.response?.status}`);
      this.logger.error(`Response: ${JSON.stringify(error.response?.data)}`);
      throw error;
    }
  }

  /**
   * Enviar mensagem com botões interativos via Evolution API
   * Usando formato de BUTTONS da documentação oficial
   */

  async sendButtons(params: {
    to: string;
    title: string;
    description: string;
    footer: string;
    buttons: Array<{
      id: string;
      title: string;
    }>;
  }): Promise<any> {
    try {
      const cleanNumber = params.to.replace(/\D/g, '');

      this.logger.log(`📤 Enviando mensagem com BOTÕES para ${cleanNumber}`);
      this.logger.log(`🔘 ${params.buttons.length} botões: ${params.buttons.map(b => b.title).join(', ')}`);

      const payload = {
        number: cleanNumber,
        title: params.title,
        description: params.description,
        footer: params.footer,
        buttons: params.buttons.map(btn => ({
          type: 'reply',
          displayText: btn.title,
          id: btn.id,
        })),
      };

      this.logger.log(`📦 Payload (Buttons): ${JSON.stringify(payload, null, 2)}`);

      const response = await this.httpClient.post('/message/sendButtons/intelisensor', payload);

      this.logger.log(`✅ Botões enviados com sucesso!`);
      this.logger.log(`📊 Response: ${JSON.stringify(response.data)}`);
      
      return response.data;
    } catch (error: any) {
      this.logger.error(`❌ Erro ao enviar botões: ${JSON.stringify(error.response?.data)}`);
      this.logger.error(`Status Code: ${error.response?.status}`);
      this.logger.error(`Error Message: ${error.message}`);
      
      this.logger.warn('⚠️ Enviando como texto simples (fallback)...');
      return await this.sendTextWithOptions(params);
    }
  }

  /**
   * Fallback: enviar como texto com opções numeradas
   */
  private async sendTextWithOptions(params: {
    to: string;
    title: string;
    description: string;
    footer: string;
    buttons: Array<{ id: string; title: string }>;
  }): Promise<any> {
    const optionsText = params.buttons
      .map((btn, index) => `${index + 1}. ${btn.title}`)
      .join('\n');

    const message = `*${params.title}*

${params.description}

📋 *Responda com o número da opção:*
${optionsText}

${params.footer}`;

    return await this.sendText(params.to, message);
  }

  /**
   * Enviar alerta de queda COM BOTÕES INTERATIVOS
   */
  async sendFallAlertWithButtons(params: {
    to: string;
    alertId: string;
    patientName: string;
    location: string;
    contactName: string;
    priority: number;
  }): Promise<any> {
    const priorityEmoji = params.priority === 1 ? '⭐' : '📱';
    const priorityText = params.priority === 1 
      ? 'Você é o contato prioritário!' 
      : `Contato de prioridade ${params.priority}`;

    return await this.sendButtons({
      to: params.to,
      title: '🚨 ALERTA DE QUEDA DETECTADA',
      description: `Olá, ${params.contactName}!

Detectamos uma possível queda de *${params.patientName}*.

📍 Ver localização:
${params.location}

${priorityEmoji} ${priorityText}

⏱️ Por favor, responda o mais rápido possível!`,
      footer: '🤖 Sistema InteliSensor',
      buttons: [
        {
          id: `confirm_emergency_${params.alertId}`,
          title: '✅ Confirmar Emergência',
        },
        {
          id: `verify_${params.alertId}`,
          title: '🔍 Estou Verificando',
        },
        {
          id: `false_alarm_${params.alertId}`,
          title: '❌ Falso Alarme',
        },
      ],
    });
  }

  /**
   * Enviar lembrete de verificação COM OPÇÕES NUMÉRICAS
   */
  async sendVerificationReminderWithButtons(params: {
    to: string;
    alertId: string;
    patientName: string;
    location: string;
    contactName: string;
  }): Promise<any> {
    const message = `⏰ *LEMBRETE: Você está verificando?*

${params.contactName}, você indicou que estava verificando.

Paciente: *${params.patientName}*

📍 Localização:
${params.location}

Por favor, confirme o status atual:

📋 *Responda com o número da opção:*
1. 🚨 É Emergência!
2. ✅ Está Tudo Bem

🤖 Sistema InteliSensor`;

    return await this.sendText(params.to, message);
  }

  /**
   * Enviar alerta de queda
   */
  async sendFallAlert(to: string, patientName: string, location: string, contactName: string, priority: number): Promise<any> {
    const priorityText = priority === 1 
      ? '\n\n⭐ Você é o contato prioritário!' 
      : `\n\n(Contato de prioridade ${priority})`;

    const message = `🚨 *ALERTA DE QUEDA*

Olá, ${contactName}!

Detectamos uma possível queda de *${patientName}*.

📍 Localização: ${location}

Por favor, nos ajude respondendo:
✅ "Falso Alerta" - se souber que está tudo bem
🏃 "Estou Indo Verificar" - se vai checar pessoalmente

Contamos com você! 🙏${priorityText}`;

    return await this.sendText(to, message);
  }

  /**
   * Enviar confirmação de emergência
   */
  async sendEmergencyConfirmed(to: string, patientName: string, location: string, contactName: string, priority: number): Promise<any> {
    const priorityText = priority === 1 
      ? '\n\n⭐ Você é o contato prioritário!' 
      : `\n\n(Contato de prioridade ${priority})`;

    const message = `🚨 *EMERGÊNCIA - Queda Confirmada*

Olá, ${contactName}!

*${patientName}* sofreu uma queda e precisa de ajuda URGENTE!

📍 Última localização conhecida:
${location}

⚠️ Por favor:
• Vá verificar o mais rápido possível
• Ligue para emergência se necessário (192/193)
• Avise outros familiares

Cada segundo conta! 🙏${priorityText}`;

    return await this.sendText(to, message);
  }

  /**
   * Enviar notificação de falso alarme
   */
  async sendFalseAlarm(to: string, patientName: string, responderName: string): Promise<any> {
    const message = `✅ *FALSO ALARME*

Oi! 😊

Boas notícias sobre *${patientName}*!

${responderName} confirmou que foi um *falso alarme*. Tudo está bem! ✨

Você pode ficar tranquilo(a). 💚`;

    return await this.sendText(to, message);
  }

  /**
   * Enviar lembrete de verificação
   */
  async sendVerificationReminder(to: string, patientName: string, location: string, contactName: string): Promise<any> {
    const message = `⏰ *LEMBRETE DE VERIFICAÇÃO*

Olá, ${contactName}!

Você indicou que estava verificando o alerta de *${patientName}*.

📍 Localização: ${location}

⚠️ Por favor, confirme o status pelo aplicativo InteliSensor ou responda esta mensagem.

Aguardamos seu retorno! 🙏`;

    return await this.sendText(to, message);
  }

  /**
   * Enviar alerta resolvido
   */
  async sendAlertResolved(to: string, patientName: string, responderName: string, resolvedByCall: boolean): Promise<any> {
    const resolveMethod = resolvedByCall 
      ? 'atendeu à chamada' 
      : 'confirmou através do aplicativo';

    const message = `✅ *ALERTA RESOLVIDO*

${responderName} já ${resolveMethod} sobre ${patientName}.

O alerta foi marcado como RESOLVIDO. Não é necessária mais nenhuma ação da sua parte.

Obrigado pela atenção! 🙏`;

    return await this.sendText(to, message);
  }
}
