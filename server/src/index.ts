import { WebSocketServer, WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { DEFAULT_SERVER_PORT, TICK_INTERVAL_MS, TICK_RATE_HZ, RESPAWN_COOLDOWN_MS } from '../../shared/constants.js';
import type { ClientToServerMessage, WelcomeMessage } from '../../shared/protocol.js';
import { ServerWorld } from './ServerWorld.js';

export interface ConnectedPlayer {
  ws: WebSocket;
  name: string;
}

export interface GameServer {
  wss: WebSocketServer;
  players: Map<string, ConnectedPlayer>;
  world: ServerWorld;
  close: () => Promise<void>;
}

export function createServer(port: number): GameServer {
  const players = new Map<string, ConnectedPlayer>();
  const world = new ServerWorld();
  let tick = 0;

  const wss = new WebSocketServer({ host: '0.0.0.0', port });

  // Tick loop — simulates world then broadcasts a snapshot every 50 ms
  const tickInterval = setInterval(() => {
    tick += 1;
    if (players.size > 0) world.tick(TICK_INTERVAL_MS);
    const snapshot = world.getSnapshot(tick);
    const payload = JSON.stringify(snapshot);
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(payload);
      }
    });
  }, TICK_INTERVAL_MS);

  wss.on('connection', (ws) => {
    const playerId = nanoid();
    console.log(`[server] client connected — assigned id=${playerId}`);

    ws.on('message', (raw) => {
      let msg: ClientToServerMessage;
      try {
        msg = JSON.parse(raw.toString()) as ClientToServerMessage;
      } catch {
        console.warn(`[server] id=${playerId} sent malformed JSON`);
        return;
      }

      if (!msg.type) {
        console.warn(`[server] id=${playerId} sent message without type`);
        return;
      }

      if (msg.type === 'hello') {
        const name = msg.name ?? 'unknown';
        players.set(playerId, { ws, name });
        world.addPlayer(playerId, name);
        console.log(`[server] id=${playerId} name="${name}" registered (total=${players.size})`);

        const welcome: WelcomeMessage = {
          type: 'welcome',
          playerId,
          mapId: 'raycast-level-01',
          config: {
            tickRate: TICK_RATE_HZ,
            respawnCooldownMs: RESPAWN_COOLDOWN_MS
          }
        };
        ws.send(JSON.stringify(welcome));
        return;
      }

      if (msg.type === 'input') {
        world.updatePlayerInput(playerId, { x: msg.x, y: msg.y, yaw: msg.yaw, seq: msg.seq });
        return;
      }
    });

    ws.on('close', () => {
      players.delete(playerId);
      world.removePlayer(playerId);
      console.log(`[server] id=${playerId} disconnected (total=${players.size})`);
    });

    ws.on('error', (err) => {
      console.error(`[server] id=${playerId} error: ${err.message}`);
    });
  });

  wss.on('error', (err) => {
    console.error(`[server] fatal: ${err.message}`);
  });

  function close(): Promise<void> {
    clearInterval(tickInterval);
    return new Promise((resolve, reject) => {
      wss.close((err) => (err ? reject(err) : resolve()));
    });
  }

  return { wss, players, world, close };
}

// Only auto-start when this file is the entrypoint (not imported by tests)
const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  const port = process.env.PORT ? Number(process.env.PORT) : DEFAULT_SERVER_PORT;
  const server = createServer(port);
  server.wss.on('listening', () => {
    console.log(`[server] listening on ws://0.0.0.0:${port}`);
  });
}
