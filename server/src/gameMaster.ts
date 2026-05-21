export const OLLAMA_TIMEOUT_MS = 15_000;

const DEFAULT_OLLAMA_BASE_URL = 'http://localhost:11434';

/** Base Ollama URL (no trailing slash). Override with OLLAMA_BASE_URL (Docker: http://ollama:11434). */
export function getOllamaBaseUrl(): string {
  const raw = process.env.OLLAMA_BASE_URL?.trim();
  const base = raw && raw.length > 0 ? raw : DEFAULT_OLLAMA_BASE_URL;
  return base.replace(/\/$/, '');
}

export function getOllamaGenerateUrl(): string {
  return `${getOllamaBaseUrl()}/api/generate`;
}

/** @deprecated Use {@link getOllamaGenerateUrl} — kept for tests/docs references. */
export const OLLAMA_GENERATE_URL = DEFAULT_OLLAMA_BASE_URL + '/api/generate';

export const OLLAMA_MODEL = process.env.OLLAMA_MODEL?.trim() || 'llama3.2:3b';

export interface NarrateRequest {
  context?: string;
  event?: string;
  /** Client requests spoken output when true; server still requires GAME_MASTER_TTS. */
  tts?: boolean;
}

export interface NarrateResponse {
  message: string;
  source: 'ollama' | 'fallback';
}

const FALLBACK_MESSAGES: readonly string[] = [
  'La estación cruje. Algo se mueve en la penumbra—no pierdas el ritmo.',
  'Señal débil, pulso fuerte. Avanza: el corredor no se va a limpiar solo.',
  'El polvo del búnker sabe tu nombre. Dispara primero, pregunta después.',
  'Eco metálico a la izquierda. Si era enemigo, ya lo sentiste; si no, sigue.',
  'El terminal parpadea rojo. La misión sigue viva mientras tú respires.',
  'Silencio de radio, ruido de dientes. Eso no es viento—es hambre.',
];

export function pickFallbackMessage(seed = Date.now()): string {
  const index = Math.abs(seed) % FALLBACK_MESSAGES.length;
  return FALLBACK_MESSAGES[index] ?? FALLBACK_MESSAGES[0];
}

export function buildGameMasterPrompt(body: NarrateRequest): string {
  const context = body.context?.trim() || 'sector hostil, terminal dañado';
  const event = body.event?.trim() || 'el jugador avanza con cautela';

  return [
    'Eres el Game Master de un FPS retro raycast en español (México).',
    'Responde en UNA sola línea (máx. 22 palabras), tono tensión arcade/horror.',
    'Sin listas, sin emojis, sin romper la cuarta pared.',
    `Contexto: ${context}.`,
    `Evento: ${event}.`,
    'Narración:',
  ].join(' ');
}

function trimModelReply(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 220);
}

export async function callOllama(prompt: string): Promise<string | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OLLAMA_TIMEOUT_MS);

  try {
    const response = await fetch(getOllamaGenerateUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;

    const data = (await response.json()) as { response?: string };
    const message = data.response?.trim();
    return message ? trimModelReply(message) : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

export async function narrate(body: NarrateRequest = {}): Promise<NarrateResponse> {
  const prompt = buildGameMasterPrompt(body);
  const ollamaMessage = await callOllama(prompt);

  if (ollamaMessage) {
    return { message: ollamaMessage, source: 'ollama' };
  }

  return { message: pickFallbackMessage(), source: 'fallback' };
}
