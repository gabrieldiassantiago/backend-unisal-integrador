// src/whatsapp/whatsapp.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Client, LocalAuth, WAState } from 'whatsapp-web.js';
import * as qrcode from 'qrcode-terminal';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private logger = new Logger(WhatsAppService.name);
  private client: Client;
  private isConnected = false;

  async onModuleInit() {
    this.startClient();
  }

  private startClient() {
    // A opção 'LocalAuth' armazena a sessão em uma pasta 'wwebjs_auth'
    // Você pode usar o 'path' para especificar um nome de pasta diferente
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: 'wweb_auth_data' }),
      puppeteer: {
        // Opções para executar em ambientes de produção (sem GUI)
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ],
      },
    });

    // Evento de QR Code
    this.client.on('qr', (qr) => {
      this.isConnected = false;
      this.logger.log('QR Code gerado. Escaneie para conectar.');
      qrcode.generate(qr, { small: true });
    });

    // Evento de autenticação
    this.client.on('authenticated', () => {
      this.logger.log('Autenticação bem-sucedida!');
    });

    // Evento de conexão pronta
    this.client.on('ready', async () => {
      this.isConnected = true;
      this.logger.log('\x1b[32m%s\x1b[0m', '✅ WhatsApp conectado com sucesso!');

      // Envia mensagem de teste assim que conectar
      try {
        await this.enviarTexto('5512981082276', '🚀 Conexão estabelecida com sucesso!');
        this.logger.log('Mensagem de teste enviada para 5512981082276');
      } catch (err) {
        this.logger.error('Erro ao enviar mensagem de teste:', err);
      }
    });

    // Evento de desconexão
    this.client.on('disconnected', (reason: WAState) => {
      this.isConnected = false;
      this.logger.warn(`Conexão perdida. Tentando reconectar... Motivo: ${reason}`);
      // Lógica de reconexão
      this.client.destroy().then(() => this.startClient());
    });

    this.client.initialize();
  }

  async enviarTexto(telefone: string, mensagem: string) {
    if (!this.isConnected) {
      throw new Error('Cliente do WhatsApp não está conectado.');
    }
    const sanitizedNumber = telefone.replace(/\D/g, '');
    const chatId = `${sanitizedNumber}@c.us`;

    try {
      await this.client.sendMessage(chatId, mensagem);
      this.logger.log(`Mensagem enviada para ${chatId}`);
    } catch (err) {
      this.logger.error(`Falha ao enviar mensagem para ${chatId}:`, err);
      throw new Error(`Falha ao enviar mensagem para ${telefone}`);
    }
  }

  // O whatsapp-web.js não tem um método nativo para "pairing code".
  // Essa funcionalidade não é necessária, pois a autenticação é via QR Code.
  // Você pode remover este método.
  async gerarPairingCode(phoneNumber: string): Promise<string> {
    throw new Error('Funcionalidade de pairing code não suportada por whatsapp-web.js.');
  }
}