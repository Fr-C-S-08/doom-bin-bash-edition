import type { ClientToServerMessage, ServerToClientMessage, WelcomeMessage } from '../../../shared/protocol.js';

type MessageHandler<T> = (msg: T) => void;

export class NetClient {
  private ws: WebSocket | null = null;
  private readonly listeners = new Map<string, Set<MessageHandler<unknown>>>();
  private inputSeq = 0;
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

  sendInput(x: number, y: number, yaw: number, keys: string[]): void {
    this.inputSeq += 1;
    this.send({ type: 'input', seq: this.inputSeq, x, y, yaw, keys });
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
