import { createServer as createHttpServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { nanoid } from 'nanoid';
import { getOllamaBaseUrl, narrate, OLLAMA_MODEL, type NarrateRequest } from './gameMaster.js';
import {
  isGameMasterTtsEnabled,
  isGameMasterTtsRequestEnabled,
  speakGameMasterNarration,
} from './gameMasterTts.js';
import {
  DEFAULT_SERVER_PORT,
  TICK_INTERVAL_MS,
  TICK_RATE_HZ,
  RESPAWN_COOLDOWN_MS,
} from '../../shared/constants.js';
import type { ClientToServerMessage, WelcomeMessage } from '../../shared/protocol.js';
import { ServerWorld } from './ServerWorld.js';

const PORT = Number(process.env.PORT ?? DEFAULT_SERVER_PORT);
const GAME_CLIENT_ORIGIN = process.env.GAME_CLIENT_ORIGIN ?? 'http://localhost:5173';

/**
 * Returns true when a WebSocket Origin header should be allowed.
 *
 * Accepted:
 *   - undefined  — Node.js test clients send no Origin header.
 *   - localhost / 127.0.0.1 — loopback, any port.
 *   - RFC-1918 private ranges: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16.
 *   - The value of GAME_CLIENT_ORIGIN (env-configured production origin).
 *
 * Everything else (public IPs, arbitrary hostnames) is rejected.
 */
export function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;
  if (origin === GAME_CLIENT_ORIGIN) return true;

  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }

  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;

  // Parse dotted-decimal IPv4 and check RFC-1918 private ranges.
  const parts = hostname.split('.');
  if (parts.length !== 4) return false;
  const octets = parts.map(Number);
  if (octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return false;

  const [a, b] = octets as [number, number, number, number];
  if (a === 10) return true;                           // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true;   // 172.16.0.0/12
  if (a === 192 && b === 168) return true;             // 192.168.0.0/16

  return false;
}

// ── Express app (game master HTTP routes) ────────────────────────────────────

const app = express();
app.use(cors({ origin: GAME_CLIENT_ORIGIN }));
app.use(express.json({ limit: '32kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/game-master/narrate', async (req, res) => {
  const body = (req.body ?? {}) as NarrateRequest;
  const result = await narrate(body);
  res.json(result);
  speakGameMasterNarration(result.message, result.source, {
    enabled: isGameMasterTtsRequestEnabled(body.tts),
  });
});

// ── Exported types ───────────────────────────────────────────────────────────

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

// ── Unified server factory ───────────────────────────────────────────────────

export function createServer(port: number): GameServer {
  const players = new Map<string, ConnectedPlayer>();
  const world = new ServerWorld();
  let tick = 0;

  const httpServer = createHttpServer(app);

  // WebSocket connections are NOT governed by the Express CORS middleware —
  // that only covers HTTP requests. We validate the Origin header here instead.
  const wss = new WebSocketServer({
    server: httpServer,
    verifyClient: ({ origin }: { origin: string | undefined }) => isAllowedOrigin(origin),
  });

  // Tick loop: simulate world state and broadcast snapshot at 20 Hz
  const tickInterval = setInterval(() => {
    tick += 1;
    if (players.size > 0) world.tick(TICK_INTERVAL_MS);

    const payload = JSON.stringify(world.getSnapshot(tick));
    wss.clients.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(payload);
    });

    const events = world.drainEvents();
    for (const ev of events) {
      const evPayload = JSON.stringify(ev);
      wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(evPayload);
      });
    }
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
        const currentLevelId = world.getCurrentLevelId();
        console.log(
          `[server] id=${playerId} name="${name}" joined on level=${currentLevelId} (total=${players.size})`,
        );
        const welcome: WelcomeMessage = {
          type: 'welcome',
          playerId,
          mapId: currentLevelId,
          config: { tickRate: TICK_RATE_HZ, respawnCooldownMs: RESPAWN_COOLDOWN_MS },
        };
        ws.send(JSON.stringify(welcome));
        return;
      }

      if (msg.type === 'input') {
        world.updatePlayerInput(playerId, { x: msg.x, y: msg.y, yaw: msg.yaw, seq: msg.seq });
        return;
      }

      if (msg.type === 'shoot') {
        world.handleShoot(playerId, msg.x, msg.y, msg.yaw, msg.weapon);
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
    console.error(`[server] fatal WS: ${err.message}`);
  });

  httpServer.listen(port);

  function close(): Promise<void> {
    clearInterval(tickInterval);
    // With { server: httpServer }, wss.close() does not close the httpServer.
    // Close both explicitly so tests and graceful-shutdown don't leak.
    return new Promise((resolve, reject) => {
      wss.close((wsErr) => {
        httpServer.close((httpErr) => {
          const err = wsErr ?? httpErr;
          err ? reject(err) : resolve();
        });
      });
    });
  }

  return { wss, players, world, close };
}

// ── Auto-start when this file is the entrypoint (not when imported by tests) ─

const isMain = process.argv[1]?.endsWith('index.ts') || process.argv[1]?.endsWith('index.js');
if (isMain) {
  const server = createServer(PORT);
  server.wss.once('listening', () => {
    const tts = isGameMasterTtsEnabled() ? 'on' : 'off';
    console.log(
      `[game-master] http://localhost:${PORT} (CORS ${GAME_CLIENT_ORIGIN}, TTS ${tts}, Ollama ${getOllamaBaseUrl()}, model ${OLLAMA_MODEL})`,
    );
    console.log(`[server] ws://0.0.0.0:${PORT} (WebSocket multiplayer, 20 Hz)`);
  });
}
