import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';

export const GAME_MASTER_TTS_MAX_CHARS = 180;

const SAY_BINARY = 'say';

let activeSay: ChildProcess | null = null;

export type SaySpawner = (
  command: string,
  args: readonly string[],
  options?: SpawnOptions,
) => ChildProcess;

export function isGameMasterTtsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.GAME_MASTER_TTS?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

/** Server speaks only when env allows TTS and the client asked for voice. */
export function isGameMasterTtsRequestEnabled(
  clientWantsTts: boolean | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return isGameMasterTtsEnabled(env) && clientWantsTts === true;
}

/** Normalizes and caps text before passing to macOS `say`. */
export function sanitizeTextForSay(text: string): string | null {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return null;

  const safe = normalized
    .replace(/[\r\n]/g, ' ')
    .replace(/[^\p{L}\p{N}\p{M}\p{P}\p{Zs}]/gu, '')
    .replace(/["'`$\\;|&<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!safe) return null;
  if (safe.length <= GAME_MASTER_TTS_MAX_CHARS) return safe;
  return `${safe.slice(0, GAME_MASTER_TTS_MAX_CHARS - 1)}…`;
}

export function shouldSpeakGameMasterNarration(message: string, source?: string): boolean {
  if (!source?.trim()) return false;
  return sanitizeTextForSay(message) !== null;
}

export function stopActiveGameMasterSay(): void {
  if (!activeSay) return;
  try {
    activeSay.kill('SIGTERM');
  } catch {
    // Process may already be gone.
  }
  activeSay = null;
}

/** Clears in-flight TTS state (tests). */
export function resetGameMasterTtsState(): void {
  stopActiveGameMasterSay();
}

function trackSayProcess(child: ChildProcess): void {
  activeSay = child;
  const clearIfCurrent = () => {
    if (activeSay === child) activeSay = null;
  };
  child.once('exit', clearIfCurrent);
  child.once('error', clearIfCurrent);
}

export function speakGameMasterNarration(
  message: string,
  source: string,
  options: {
    enabled?: boolean;
    platform?: NodeJS.Platform;
    spawnProcess?: SaySpawner;
  } = {},
): void {
  const enabled = options.enabled ?? isGameMasterTtsEnabled();
  if (!enabled) return;

  const platform = options.platform ?? process.platform;
  if (platform !== 'darwin') return;
  if (!shouldSpeakGameMasterNarration(message, source)) return;

  const text = sanitizeTextForSay(message);
  if (!text) return;

  const spawnProcess = options.spawnProcess ?? spawn;
  stopActiveGameMasterSay();

  try {
    const child = spawnProcess(SAY_BINARY, [text], {
      stdio: 'ignore',
      detached: false,
    });
    trackSayProcess(child);
  } catch {
    activeSay = null;
  }
}
