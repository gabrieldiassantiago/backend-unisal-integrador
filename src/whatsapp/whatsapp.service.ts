import { Boom } from '@hapi/boom';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from 'baileys';
import * as qrcode from 'qrcode-terminal';

@Injectable()
export class WhatsAppService implements OnModuleInit {
  private logger = new Logger(WhatsAppService.name);
  private sock: ReturnType<typeof makeWASocket> | null = null;
  private isConnected = false;

  async onModuleInit() {
    this.startSocket();
  }

  private async startSocket() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: false // Desabilita o QR automático
    });

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (connection === 'open') {
        this.isConnected = true;
        console.log('\x1b[32m%s\x1b[0m', '✅ WhatsApp conectado com sucesso!');
        this.logger.log('WhatsApp conectado');

        // 🚀 Envia mensagem teste assim que conectar
        try {
          await this.enviarTexto('5512981082276', '🚀 Conexão estabelecida com sucesso!');
          this.logger.log('Mensagem de teste enviada para 5512981082276');
        } catch (err) {
          this.logger.error('Erro ao enviar mensagem de teste:', err);
        }
      }

      if (connection === 'close') {
        this.isConnected = false;

        const statusCode = (lastDisconnect?.error as Boom)?.output?.statusCode;

        if (statusCode === DisconnectReason.restartRequired) {
          this.logger.warn('Conexão perdida, reconectando...');
          this.startSocket();
        } else {
          this.logger.warn(`Conexão fechada (${statusCode}), aguardando ação...`);
        }
      }

      // Só exibe QR code se não estiver conectado
      if (qr && !this.isConnected) {
        qrcode.generate(qr, { small: true });
        this.logger.log('QR Code gerado. Escaneie para conectar.');
      }
    });

    this.sock.ev.on('creds.update', saveCreds);
  }

  async enviarTexto(telefone: string, mensagem: string) {
    if (!this.sock) throw new Error('Socket Baileys não está inicializado.');
    const jid = `${telefone.replace(/\D/g, '')}@s.whatsapp.net`;
    await this.sock.sendMessage(jid, { text: mensagem });
    this.logger.log(`Mensagem enviada para ${jid}`);
  }

  async gerarPairingCode(phoneNumber: string): Promise<string> {
    if (!this.sock) {
      throw new Error('Socket Baileys não está inicializado.');
    }
    const code = await this.sock.requestPairingCode(phoneNumber);
    this.logger.log(`Pairing code gerado: ${code}`);
    return code;
  }
}
