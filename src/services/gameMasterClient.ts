export type GameMasterSource = 'ollama' | 'fallback';

export interface GameMasterRequest {
  context: string;
  event: string;
}

export interface GameMasterResponse {
  message: string;
  source: GameMasterSource;
}

export const GAME_MASTER_NARRATE_URL =
  'http://localhost:3001/api/game-master/narrate';

export const GAME_MASTER_CLIENT_TIMEOUT_MS = 8_000;

const CLIENT_FALLBACK_MESSAGES: readonly string[] = [
  'La estación guarda silencio. Sigue avanzando.',
  'Sin enlace al narrador. El búnker no espera.',
  'Señal perdida. Tus pasos son la única pista.',
];

export function pickClientFallbackMessage(seed = Date.now()): string {
  const index = Math.abs(seed) % CLIENT_FALLBACK_MESSAGES.length;
  return CLIENT_FALLBACK_MESSAGES[index] ?? CLIENT_FALLBACK_MESSAGES[0];
}

function buildClientFallbackResponse(seed?: number): GameMasterResponse {
  return {
    message: pickClientFallbackMessage(seed),
    source: 'fallback',
  };
}

function isGameMasterSource(value: unknown): value is GameMasterSource {
  return value === 'ollama' || value === 'fallback';
}

function parseGameMasterResponse(payload: unknown): GameMasterResponse | null {
  if (!payload || typeof payload !== 'object') return null;

  const record = payload as Record<string, unknown>;
  const message = typeof record.message === 'string' ? record.message.trim() : '';
  const source = record.source;

  if (!message || !isGameMasterSource(source)) return null;

  return { message, source };
}

export async function requestNarration(
  request: GameMasterRequest,
  options: { url?: string; timeoutMs?: number } = {},
): Promise<GameMasterResponse> {
  const url = options.url ?? GAME_MASTER_NARRATE_URL;
  const timeoutMs = options.timeoutMs ?? GAME_MASTER_CLIENT_TIMEOUT_MS;

  const body: GameMasterRequest = {
    context: request.context.trim(),
    event: request.event.trim(),
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      return buildClientFallbackResponse();
    }

    const payload: unknown = await response.json();
    const parsed = parseGameMasterResponse(payload);
    return parsed ?? buildClientFallbackResponse();
  } catch {
    return buildClientFallbackResponse();
  } finally {
    clearTimeout(timeout);
  }
}
