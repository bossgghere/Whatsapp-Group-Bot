import http from 'http';
import { BaileysWhatsAppGateway } from '../infrastructure/whatsapp/baileys-client.js';
import { ITicketRepository } from '../domain/repositories/ticket-repo.js';

export function startHttpServer(
  whatsappGateway: BaileysWhatsAppGateway,
  ticketRepo?: ITicketRepository,
  port = Number(process.env.PORT) || 3000
): http.Server {
  const startTime = Date.now();

  const server = http.createServer((req, res) => {
    const url = req.url || '/';

    if (url === '/health' || url === '/ping') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', uptime: Math.floor((Date.now() - startTime) / 1000) }));
      return;
    }

    if (url === '/pair') {
      const code = whatsappGateway.getPairingCode();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ pairingCode: code, connected: whatsappGateway.isConnected() }));
      return;
    }

    // Default: Dashboard page
    const isConnected = whatsappGateway.isConnected();
    const pairingCode = whatsappGateway.getPairingCode();
    const uptimeMinutes = Math.floor((Date.now() - startTime) / 60000);

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TechSync WhatsApp Bot — Status</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { background: #1e293b; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); padding: 32px; max-width: 480px; width: 100%; text-align: center; border: 1px solid #334155; }
    .badge { display: inline-flex; align-items: center; gap: 8px; padding: 6px 16px; border-radius: 9999px; font-weight: 600; font-size: 14px; margin-bottom: 24px; }
    .badge-online { background: #064e3b; color: #34d399; border: 1px solid #059669; }
    .badge-pairing { background: #78350f; color: #fbbf24; border: 1px solid #d97706; }
    .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .dot-online { background: #10b981; box-shadow: 0 0 10px #10b981; }
    .dot-pairing { background: #f59e0b; box-shadow: 0 0 10px #f59e0b; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    p { color: #94a3b8; font-size: 15px; margin: 0 0 24px; }
    .code-box { background: #0f172a; border: 2px dashed #3b82f6; border-radius: 12px; padding: 18px; margin: 20px 0; font-size: 28px; font-family: monospace; font-weight: bold; letter-spacing: 4px; color: #60a5fa; }
    .info { background: #0f172a; border-radius: 10px; padding: 16px; text-align: left; font-size: 13px; color: #94a3b8; margin-top: 24px; border: 1px solid #334155; }
    .footer { font-size: 12px; color: #64748b; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    ${
      isConnected
        ? `<div class="badge badge-online"><span class="dot dot-online"></span> BOT ONLINE & ACTIVE</div>`
        : `<div class="badge badge-pairing"><span class="dot dot-pairing"></span> AWAITING WHATSAPP LINK</div>`
    }
    <h1>🤖 TechSync WhatsApp Bot</h1>
    <p>AI Group Memory, Task Tracker & Assistant</p>

    ${
      pairingCode
        ? `<div>
            <div style="font-size: 13px; color: #cbd5e1; text-transform: uppercase; font-weight: 600;">Link with Phone Number Code:</div>
            <div class="code-box">${pairingCode}</div>
            <div style="font-size: 13px; color: #94a3b8;">Open WhatsApp ➔ Linked Devices ➔ Link with phone number instead</div>
          </div>`
        : isConnected
        ? `<div style="padding: 20px; background: #064e3b; border-radius: 12px; color: #6ee7b7; font-weight: 500;">
            Connected to WhatsApp! The bot is actively listening and responding in your groups.
          </div>`
        : `<div style="color: #94a3b8;">Connecting to WhatsApp network...</div>`
    }

    <div class="info">
      <div>⏱️ <strong>Uptime:</strong> ${uptimeMinutes} minutes</div>
      <div>⚡ <strong>Server:</strong> Render Cloud / Node.js</div>
      <div>🧠 <strong>AI Engine:</strong> Google Gemini Flash</div>
    </div>
    <div class="footer">Auto-refreshes every 15s • TechSync Solutions</div>
  </div>
  <script>setTimeout(() => location.reload(), 15000);</script>
</body>
</html>`;

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });

  server.listen(port, () => {
    console.log(`[HTTP] Status server listening on port ${port}`);
  });

  // Self-ping to prevent Render sleep mode if RENDER_EXTERNAL_URL is configured
  const externalUrl = process.env.RENDER_EXTERNAL_URL;
  if (externalUrl) {
    console.log(`[KeepAlive] Enabling automatic self-ping for: ${externalUrl}`);
    setInterval(async () => {
      try {
        await fetch(`${externalUrl}/health`);
        console.log('[KeepAlive] Self-ping successful.');
      } catch (err) {
        console.warn('[KeepAlive] Self-ping failed:', err);
      }
    }, 10 * 60 * 1000); // Every 10 minutes
  }

  return server;
}
