import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, LocalAuth } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private logger = new Logger(WhatsAppService.name);
  private client: Client | null = null;
  private isConnected = false;

  async onModuleInit() {
    this.initializeClient();
  }

  private initializeClient() {
    // Inicializa o cliente com LocalAuth para persistir sessão
    this.client = new Client({
      authStrategy: new LocalAuth({
        dataPath: '.wwebjs_auth', // Pasta onde salva a sessão
        clientId: 'main-client' // ID único do cliente
      }),
      puppeteer: {
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
        headless: true
      }
    });

    this.setupEventListeners();
    this.client.initialize();
  }

  private setupEventListeners() {
    // Evento QR Code - exibe no terminal
    this.client.on('qr', (qr) => {
      if (!this.isConnected) {
        qrcode.generate(qr, { small: true });
        this.logger.log('📱 QR Code gerado. Escaneie para conectar.');
      }
    });

    // Evento de autenticação bem-sucedida
    this.client.on('authenticated', () => {
      this.logger.log('✅ Autenticado com sucesso!');
    });

    // Evento cliente pronto
    this.client.on('ready', async () => {
      this.isConnected = true;
      console.log('\x1b[32m%s\x1b[0m', '✅ WhatsApp conectado com sucesso!');
      this.logger.log('WhatsApp conectado e pronto!');

      // 🚀 Envia mensagem teste assim que conectar
      try {
        const numero = '5512981082276';
        await this.enviarTexto(numero, '🚀 Conexão estabelecida com sucesso!');
        this.logger.log(`Mensagem de teste enviada para ${numero}`);
      } catch (err) {
        this.logger.error('Erro ao enviar mensagem de teste:', err);
      }
    });

    // Evento de falha de autenticação
    this.client.on('auth_failure', (message) => {
      this.isConnected = false;
      this.logger.error('❌ Falha na autenticação:', message);
    });

    // Evento de desconexão
    this.client.on('disconnected', (reason) => {
      this.isConnected = false;
      this.logger.warn(`⚠️ Desconectado: ${reason}`);
      
      // Reconecta automaticamente após 5 segundos
      setTimeout(() => {
        this.logger.log('Tentando reconectar...');
        this.initializeClient();
      }, 5000);
    });

    // Evento de mensagens recebidas (opcional)
    this.client.on('message', async (message) => {
      this.logger.log(`📩 Mensagem recebida de ${message.from}: ${message.body}`);
      
      // Exemplo: responde ao comando !ping
      if (message.body === '!ping') {
        await message.reply('pong! 🏓');
      }
    });
  }

  async enviarTexto(telefone: string, mensagem: string) {
    if (!this.client) {
      throw new Error('Cliente WhatsApp não está inicializado.');
    }

    if (!this.isConnected) {
      throw new Error('Cliente WhatsApp não está conectado.');
    }

    try {
      // Remove caracteres não numéricos
      const numeroLimpo = telefone.replace(/\D/g, '');
      
      // Formato: número@c.us (para contatos individuais)
      const chatId = `${numeroLimpo}@c.us`;
      
      await this.client.sendMessage(chatId, mensagem);
      this.logger.log(`✅ Mensagem enviada para ${chatId}`);
    } catch (error) {
      this.logger.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  }

  async gerarPairingCode(phoneNumber: string): Promise<string> {
    if (!this.client) {
      throw new Error('Cliente WhatsApp não está inicializado.');
    }

    try {
      // Remove caracteres não numéricos
      const numeroLimpo = phoneNumber.replace(/\D/g, '');
      
      // Gera o pairing code
      const code = await this.client.requestPairingCode(numeroLimpo);
      this.logger.log(`🔐 Pairing code gerado: ${code}`);
      return code;
    } catch (error) {
      this.logger.error('Erro ao gerar pairing code:', error);
      throw error;
    }
  }

  // Método auxiliar para verificar status
  getStatus(): { connected: boolean } {
    return { connected: this.isConnected };
  }

  // Método para destruir o cliente (cleanup)
  async destroy() {
    if (this.client) {
      await this.client.destroy();
      this.isConnected = false;
      this.logger.log('Cliente destruído');
    }
  }
}
