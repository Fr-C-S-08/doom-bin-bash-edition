import type { ClientToServerMessage, ServerToClientMessage, WelcomeMessage } from '../../../shared/protocol.js';

type MessageHandler<T> = (msg: T) => void;

export class NetClient {
  private ws: WebSocket | null = null;
  private readonly listeners = new Map<string, Set<MessageHandler<unknown>>>();
  playerId: string | null = null;

  connect(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url);
      this.ws = ws;

      ws.addEventListener('open', () => {
        // nothing yet — wait for welcome
      });

      ws.addEventListener('message', (event) => {
        let msg: ServerToClientMessage;
        try {
          msg = JSON.parse(event.data as string) as ServerToClientMessage;
        } catch {
          return;
        }

        if (msg.type === 'welcome') {
          this.playerId = (msg as WelcomeMessage).playerId;
          this.dispatch(msg.type, msg);
          resolve();
          return;
        }

        this.dispatch(msg.type, msg);
      });

      ws.addEventListener('error', () => {
        reject(new Error(`NetClient: failed to connect to ${url}`));
      });

      ws.addEventListener('close', () => {
        this.dispatch('close', {});
      });
    });
  }

  send(msg: ClientToServerMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  on<T>(type: string, handler: MessageHandler<T>): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(handler as MessageHandler<unknown>);
  }

  off<T>(type: string, handler: MessageHandler<T>): void {
    this.listeners.get(type)?.delete(handler as MessageHandler<unknown>);
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
    this.playerId = null;
    this.listeners.clear();
  }

  private dispatch(type: string, msg: unknown): void {
    this.listeners.get(type)?.forEach((handler) => handler(msg));
  }
}
