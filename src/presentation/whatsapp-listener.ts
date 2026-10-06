import { IWhatsAppGateway } from '../domain/services/whatsapp-gw.js';
import { MessageOrchestrator } from '../application/orchestrator.js';

export function attachWhatsAppListener(
  gateway: IWhatsAppGateway,
  orchestrator: MessageOrchestrator
): void {
  gateway.onMessageReceived(async (message) => {
    try {
      await orchestrator.handleMessage(message);
    } catch (err) {
      console.error('[WhatsAppListener] Error handling incoming group message:', err);
    }
  });
}
