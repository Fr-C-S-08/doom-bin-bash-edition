import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { createServer, type GameServer } from '../src/index.js';
import type { WelcomeMessage } from '../../shared/protocol.js';
import type { AddressInfo } from 'net';

function waitForReady(wss: GameServer['wss']): Promise<void> {
  return new Promise((resolve) => {
    if (wss.address()) {
      resolve();
    } else {
      wss.once('listening', resolve);
    }
  });
}

function connectClient(port: number): Promise<{ ws: WebSocket; welcome: WelcomeMessage }> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}`);

    ws.once('open', () => {
      ws.send(JSON.stringify({ type: 'hello', name: 'TestPlayer' }));
    });

    ws.once('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as WelcomeMessage;
        resolve({ ws, welcome: msg });
      } catch (err) {
        reject(err);
      }
    });

    ws.once('error', reject);
  });
}

describe('WebSocket handshake', () => {
  let server: GameServer;
  let port: number;

  beforeEach(async () => {
    // Port 0 lets the OS pick a free port
    server = createServer(0);
    await waitForReady(server.wss);
    port = (server.wss.address() as AddressInfo).port;
  });

  afterEach(async () => {
    await server.close();
  });

  it('responds to hello with a welcome containing a valid playerId', async () => {
    const { ws, welcome } = await connectClient(port);

    expect(welcome.type).toBe('welcome');
    expect(typeof welcome.playerId).toBe('string');
    expect(welcome.playerId.length).toBeGreaterThan(0);
    expect(welcome.mapId).toBe('raycast-level-01');
    expect(welcome.config.tickRate).toBe(20);
    expect(welcome.config.respawnCooldownMs).toBe(5000);

    ws.close();
  });

  it('tracks the connected player in the server Map after hello', async () => {
    const { ws, welcome } = await connectClient(port);

    // Give the server a tick to register
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(server.players.size).toBe(1);
    const entry = server.players.get(welcome.playerId);
    expect(entry).toBeDefined();
    expect(entry?.name).toBe('TestPlayer');

    ws.close();
  });

  it('removes the player from the Map on disconnect', async () => {
    const { ws, welcome } = await connectClient(port);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(server.players.has(welcome.playerId)).toBe(true);

    await new Promise<void>((resolve) => {
      server.wss.once('close', resolve);
      ws.close();
      // wss 'close' only fires when the server closes; listen to client close instead
      ws.once('close', resolve);
    });

    // Give the server a tick to clean up
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(server.players.has(welcome.playerId)).toBe(false);
  });
});
