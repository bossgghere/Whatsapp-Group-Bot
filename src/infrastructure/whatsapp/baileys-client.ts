import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage,
  proto,
  WASocket,
  Browsers,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';
import pino from 'pino';
import path from 'path';
import { IWhatsAppGateway } from '../../domain/services/whatsapp-gw.js';
import { GroupMessage, MediaType } from '../../domain/models/message.js';

export class BaileysWhatsAppGateway implements IWhatsAppGateway {
  private sock: WASocket | null = null;
  private messageHandler?: (message: GroupMessage) => Promise<void>;
  private authDir: string;
  private isStopping = false;
  private pairingPhoneNumber?: string;
  private sentByBotIds = new Set<string>();
  public latestPairingCode: string | null = null;
  public isConnectedStatus = false;

  constructor(authDir = './auth_info_baileys', pairingPhoneNumber?: string) {
    this.authDir = authDir;
    this.pairingPhoneNumber = pairingPhoneNumber;
  }

  isConnected(): boolean {
    return this.isConnectedStatus;
  }

  getPairingCode(): string | null {
    return this.latestPairingCode;
  }

  onMessageReceived(handler: (message: GroupMessage) => Promise<void>): void {
    this.messageHandler = handler;
  }

  async start(): Promise<void> {
    this.isStopping = false;
    const { state, saveCreds } = await useMultiFileAuthState(this.authDir);
    const { version } = await fetchLatestBaileysVersion();

    const logger = pino({ level: 'silent' });

    this.sock = makeWASocket({
      version,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      printQRInTerminal: false,
      logger,
      syncFullHistory: false,
      generateHighQualityLinkPreview: true,
    });

    // If pairing phone number is specified and not yet registered, request an 8-character pairing code
    if (this.pairingPhoneNumber && !state.creds.registered) {
      const cleanPhone = this.pairingPhoneNumber.replace(/[^0-9]/g, '');
      setTimeout(async () => {
        try {
          if (this.sock) {
            const code = await this.sock.requestPairingCode(cleanPhone);
            this.latestPairingCode = code;
            console.log('\n======================================================');
            console.log(`🔑 YOUR WHATSAPP PAIRING CODE: ${code}`);
            console.log('📱 Link with code:');
            console.log('  1. Open WhatsApp ➔ Linked Devices ➔ Link a Device');
            console.log('  2. Tap "Link with phone number instead" at bottom');
            console.log(`  3. Enter this 8-character code: ${code}`);
            console.log('======================================================\n');
          }
        } catch (err) {
          console.error('[WhatsApp] Failed to request pairing code:', err);
        }
      }, 4000);
    }

    // Handle authentication / connection status
    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && !this.pairingPhoneNumber) {
        console.log('\n======================================================');
        console.log('🤖 SCAN THIS QR CODE WITH YOUR WHATSAPP TO CONNECT:');
        console.log('======================================================\n');
        qrcode.generate(qr, { small: true });
        console.log('\n[WhatsApp] Waiting for QR scan from your phone...');
      }

      if (connection === 'close') {
        this.isConnectedStatus = false;
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut && !this.isStopping;
        console.log(
          `[WhatsApp] Connection closed (status: ${statusCode}). Reconnecting: ${shouldReconnect}`
        );
        if (shouldReconnect) {
          setTimeout(() => this.start(), 3000);
        }
      } else if (connection === 'open') {
        this.isConnectedStatus = true;
        this.latestPairingCode = null;
        console.log('\n✅ [WhatsApp] Connected successfully! Bot is active and listening to groups.\n');
      }
    });

    // Save auth credentials whenever updated
    this.sock.ev.on('creds.update', saveCreds);

    // Listen to incoming messages
    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify') return;

      for (const msg of messages) {
        if (!msg.message) continue;
        if (msg.key?.id && this.sentByBotIds.has(msg.key.id)) continue; // Ignore bot's own programmatic replies
        
        // Extract group vs direct chat
        const remoteJid = msg.key?.remoteJid;
        if (!remoteJid) continue;

        try {
          const parsed = await this.parseBaileysMessage(msg);
          if (parsed && this.messageHandler) {
            await this.messageHandler(parsed);
          }
        } catch (err) {
          console.error('[WhatsApp] Error processing message:', err);
        }
      }
    });
  }

  async stop(): Promise<void> {
    this.isStopping = true;
    if (this.sock) {
      this.sock.end(undefined);
      this.sock = null;
    }
  }

  async sendMessage(toGroupId: string, text: string, quotedMessageId?: string): Promise<void> {
    if (!this.sock) {
      console.warn('[WhatsApp] Cannot send message: Socket not connected.');
      return;
    }

    const options: any = {};
    const sent = await this.sock.sendMessage(toGroupId, { text }, options);
    if (sent?.key?.id) {
      this.sentByBotIds.add(sent.key.id);
      if (this.sentByBotIds.size > 200) {
        const first = this.sentByBotIds.values().next().value;
        if (first) this.sentByBotIds.delete(first);
      }
    }
  }

  private async parseBaileysMessage(raw: proto.IWebMessageInfo): Promise<GroupMessage | null> {
    const key = raw.key;
    if (!key) return null;

    const remoteJid = key.remoteJid || '';
    const senderId = key.participant || remoteJid;
    const senderName = raw.pushName || senderId.split('@')[0];

    const messageContent = raw.message;
    if (!messageContent) return null;

    let text = '';
    let mediaType: MediaType = 'text';
    let mediaMimeType: string | undefined;
    let mediaBuffer: Buffer | undefined;

    // Check message subtypes
    if (messageContent.conversation) {
      text = messageContent.conversation;
    } else if (messageContent.extendedTextMessage) {
      text = messageContent.extendedTextMessage.text || '';
    } else if (messageContent.imageMessage) {
      text = messageContent.imageMessage.caption || '';
      mediaType = 'image';
      mediaMimeType = messageContent.imageMessage.mimetype || 'image/jpeg';
    } else if (messageContent.audioMessage) {
      text = '';
      mediaType = 'audio';
      mediaMimeType = messageContent.audioMessage.mimetype || 'audio/ogg';
    } else if (messageContent.documentMessage) {
      text = messageContent.documentMessage.caption || messageContent.documentMessage.fileName || '';
      mediaType = 'document';
      mediaMimeType = messageContent.documentMessage.mimetype || 'application/pdf';
    }

    // Download media buffer if present (voice note, PDF, etc.)
    if (mediaType !== 'text' && this.sock) {
      try {
        const buffer = await downloadMediaMessage(
          raw as any,
          'buffer',
          {},
          {
            logger: pino({ level: 'silent' }),
            reuploadRequest: this.sock.updateMediaMessage,
          }
        );
        mediaBuffer = buffer as Buffer;
      } catch (err) {
        console.warn(`[WhatsApp] Could not download ${mediaType} buffer:`, err);
      }
    }

    // Check quoted message
    const contextInfo =
      messageContent.extendedTextMessage?.contextInfo ||
      messageContent.imageMessage?.contextInfo ||
      messageContent.audioMessage?.contextInfo ||
      messageContent.documentMessage?.contextInfo;

    const quotedMessageId = contextInfo?.stanzaId || undefined;
    let quotedText: string | undefined;

    if (contextInfo?.quotedMessage) {
      const qm = contextInfo.quotedMessage;
      quotedText =
        qm.conversation ||
        qm.extendedTextMessage?.text ||
        qm.imageMessage?.caption ||
        qm.documentMessage?.caption ||
        undefined;
    }

    return {
      id: key.id || `msg-${Date.now()}`,
      groupId: remoteJid,
      senderId,
      senderName,
      text,
      mediaType,
      mediaMimeType,
      mediaBuffer,
      quotedMessageId,
      quotedText,
      timestamp: raw.messageTimestamp ? Number(raw.messageTimestamp) * 1000 : Date.now(),
    };
  }
}
