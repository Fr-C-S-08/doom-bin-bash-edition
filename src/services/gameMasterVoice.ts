import type { GameMasterNarrationTier } from './gameMasterNarrationTypes';
import { GAME_MASTER_TIER_RANK } from './gameMasterNarrationTypes';

export type GameMasterVoiceStatus = 'idle' | 'unsupported' | 'blocked' | 'speaking' | 'error';

export interface GameMasterVoiceState {
  status: GameMasterVoiceStatus;
  detail: string | null;
}

export interface SpeakGameMasterVoiceOptions {
  urgent?: boolean;
  volume?: number;
  tier?: GameMasterNarrationTier;
}

const TEST_PHRASE = 'Game Master en línea. Señal de voz activa.';
const VOICE_COOLDOWN_MS = 2_200;
const CHUNK_MAX_CHARS = 118;
const VOICE_RATE = 0.86;
const VOICE_PITCH = 0.82;

const VOICE_LANG_PRIORITY = ['es-MX', 'es-ES', 'en-US'] as const;

let lastStatus: GameMasterVoiceStatus = 'idle';
let lastDetail: string | null = null;
let lastSpokeAtMs = 0;
let pendingTier: GameMasterNarrationTier | null = null;
let selectedVoiceUri: string | null = null;
let voicesPrimed = false;

export function getGameMasterVoiceState(): GameMasterVoiceState {
  return { status: lastStatus, detail: lastDetail };
}

export function isGameMasterVoiceSpeaking(): boolean {
  return lastStatus === 'speaking';
}

export function getGameMasterVoiceTestPhrase(): string {
  return TEST_PHRASE;
}

export function formatGameMasterVoiceHudLabel(enabled: boolean): string {
  if (!enabled) return 'off';
  if (lastStatus === 'idle' && !lastDetail) return 'on';
  return lastDetail ? `on (${lastDetail})` : `on (${lastStatus})`;
}

export function stripGameMasterVoicePrefixes(text: string): string {
  return text
    .replace(/\[?\s*GAME\s*MASTER\s*\]?/gi, '')
    .replace(/^RADIO\s*\/\/\s*/i, '')
    .replace(/[▌█■◆]/g, '')
    .trim();
}

export function sanitizeVoiceSpeakText(text: string, maxLen = 220): string {
  const normalized = stripGameMasterVoicePrefixes(text)
    .replace(/[^\p{L}\p{N}\s.,;:!?¡¿'"()-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return '';
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 1)}…`;
}

export function chunkVoiceSpeakText(text: string, maxChars = CHUNK_MAX_CHARS): string[] {
  const clean = sanitizeVoiceSpeakText(text, maxChars * 3);
  if (!clean) return [];
  if (clean.length <= maxChars) return [clean];

  const sentences = clean.split(/(?<=[.!?])\s+/).filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (sentence.length <= maxChars) {
      current = sentence;
    } else {
      chunks.push(`${sentence.slice(0, maxChars - 1)}…`);
      current = '';
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [clean.slice(0, maxChars)];
}

function scoreSpeechVoice(voice: SpeechSynthesisVoice, lang: string): number {
  let score = 0;
  if (voice.lang.toLowerCase().startsWith(lang.toLowerCase())) score += 10;
  if (voice.default) score += 2;
  const name = voice.name.toLowerCase();
  if (name.includes('premium') || name.includes('enhanced') || name.includes('natural')) score += 4;
  if (name.includes('google') || name.includes('samantha') || name.includes('paulina')) score += 2;
  return score;
}

export function pickPreferredSpeechVoice(
  voices: SpeechSynthesisVoice[],
  priority = VOICE_LANG_PRIORITY,
): SpeechSynthesisVoice | null {
  if (voices.length === 0) return null;
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;
  for (const lang of priority) {
    for (const voice of voices) {
      const score = scoreSpeechVoice(voice, lang);
      if (score > bestScore) {
        bestScore = score;
        best = voice;
      }
    }
    if (best && bestScore >= 10) return best;
  }
  return best ?? voices[0] ?? null;
}

function resolveSpeechVoice(): SpeechSynthesisVoice | null {
  if (typeof globalThis.speechSynthesis === 'undefined') return null;
  if (typeof globalThis.speechSynthesis.getVoices !== 'function') return null;
  const voices = globalThis.speechSynthesis.getVoices();
  if (voices.length === 0) return null;
  if (selectedVoiceUri) {
    const cached = voices.find((voice) => voice.voiceURI === selectedVoiceUri);
    if (cached) return cached;
  }
  const picked = pickPreferredSpeechVoice(voices);
  if (picked) selectedVoiceUri = picked.voiceURI;
  return picked;
}

function primeSpeechVoices(): void {
  if (voicesPrimed || typeof globalThis.speechSynthesis === 'undefined') return;
  if (typeof globalThis.speechSynthesis.getVoices !== 'function') return;
  const voices = globalThis.speechSynthesis.getVoices();
  if (voices.length > 0) {
    resolveSpeechVoice();
    voicesPrimed = true;
    return;
  }
  globalThis.speechSynthesis.onvoiceschanged = () => {
    resolveSpeechVoice();
    voicesPrimed = true;
  };
}

function mapSpeechError(error: SpeechSynthesisErrorEvent): GameMasterVoiceStatus {
  if (error.error === 'not-allowed' || error.error === 'interrupted') {
    return 'blocked';
  }
  return 'error';
}

function shouldDropForCooldown(nowMs: number, urgent: boolean, tier: GameMasterNarrationTier): boolean {
  if (urgent || tier === 'critical') return false;
  return nowMs - lastSpokeAtMs < VOICE_COOLDOWN_MS;
}

function shouldPreemptVoice(incoming: GameMasterNarrationTier): boolean {
  if (lastStatus !== 'speaking' || !pendingTier) return true;
  return GAME_MASTER_TIER_RANK[incoming] >= GAME_MASTER_TIER_RANK[pendingTier];
}

function speakChunk(
  chunk: string,
  volume: number,
  voice: SpeechSynthesisVoice | null,
  isLast: boolean,
): void {
  const utterance = new SpeechSynthesisUtterance(chunk);
  utterance.rate = VOICE_RATE;
  utterance.pitch = VOICE_PITCH;
  utterance.volume = volume;
  utterance.lang = voice?.lang ?? 'es-MX';
  if (voice) utterance.voice = voice;

  utterance.onstart = () => {
    lastStatus = 'speaking';
    lastDetail = 'speaking';
  };
  utterance.onend = () => {
    if (isLast) {
      lastStatus = 'idle';
      lastDetail = null;
      pendingTier = null;
    }
  };
  utterance.onerror = (event) => {
    const mapped = mapSpeechError(event);
    lastStatus = mapped;
    lastDetail = mapped === 'blocked' ? 'blocked' : 'error';
    pendingTier = null;
    console.warn('[GM voice] synthesis error', event.error);
  };

  globalThis.speechSynthesis.speak(utterance);
}

export function speakGameMasterVoice(text: string, options: SpeakGameMasterVoiceOptions = {}): GameMasterVoiceStatus {
  const tier = options.tier ?? 'ambient';
  const urgent = options.urgent === true || tier === 'critical';
  const volume = Math.max(0, Math.min(1, options.volume ?? 1));
  const nowMs = Date.now();
  const chunks = chunkVoiceSpeakText(text);
  if (chunks.length === 0) {
    lastStatus = 'idle';
    lastDetail = null;
    return 'idle';
  }

  if (typeof globalThis.speechSynthesis === 'undefined') {
    lastStatus = 'unsupported';
    lastDetail = 'unsupported';
    console.warn('[GM voice] speechSynthesis unavailable');
    return 'unsupported';
  }

  if (shouldDropForCooldown(nowMs, urgent, tier)) {
    return lastStatus;
  }

  if (lastStatus === 'speaking' && !shouldPreemptVoice(tier)) {
    return lastStatus;
  }

  try {
    primeSpeechVoices();
    globalThis.speechSynthesis.cancel();
    const voice = resolveSpeechVoice();
    pendingTier = tier;
    lastSpokeAtMs = nowMs;
    chunks.forEach((chunk, index) => {
      speakChunk(chunk, volume, voice, index === chunks.length - 1);
    });
    lastStatus = 'speaking';
    lastDetail = 'speaking';
    console.info('[GM voice] speaking', chunks.join(' | '));
    return 'speaking';
  } catch (error) {
    lastStatus = 'error';
    lastDetail = 'error';
    pendingTier = null;
    console.warn('[GM voice] speak failed', error);
    return 'error';
  }
}

export function speakGameMasterVoiceTest(volume = 1): GameMasterVoiceStatus {
  return speakGameMasterVoice(TEST_PHRASE, { urgent: true, volume, tier: 'important' });
}

export function cancelGameMasterVoice(): void {
  if (globalThis.speechSynthesis) {
    globalThis.speechSynthesis.cancel();
  }
  lastStatus = 'idle';
  lastDetail = null;
  pendingTier = null;
}

/** @internal Tests only */
export function resetGameMasterVoiceStateForTests(): void {
  cancelGameMasterVoice();
  lastStatus = 'idle';
  lastDetail = null;
  lastSpokeAtMs = 0;
  selectedVoiceUri = null;
  voicesPrimed = false;
}
