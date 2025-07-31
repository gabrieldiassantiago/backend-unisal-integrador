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

  async onModuleInit() {
    this.startSocket();
  }

  private async startSocket() {
    const { state, saveCreds } = await useMultiFileAuthState('baileys_auth');
    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      auth: state,
      version,
      printQRInTerminal: true
    });

    this.sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

    if (connection === 'close' && (lastDisconnect?.error as Boom)?.output?.statusCode === DisconnectReason.restartRequired) {
        this.logger.warn('Conexão perdida, reconectando...');
        this.startSocket();
    }
      if (qr) {
        qrcode.generate(qr, { small: true });
        this.logger.log('QR Code gerado. Escaneie para conectar.');
      }
    });

    this.sock.ev.on('creds.update', saveCreds);
  }

  async enviarTexto(telefone: string, mensagem: string) {
    if (!this.sock) throw new Error('Socket Baileys não está inicializado.');
    const jid = telefone.replace(/\D/g, '') + '@s.whatsapp.net';
    await this.sock.sendMessage(jid, { text: mensagem });
    this.logger.log(`Mensagem enviada para ${jid}`);
  }
}
