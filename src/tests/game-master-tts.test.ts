import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GAME_MASTER_TTS_MAX_CHARS,
  isGameMasterTtsEnabled,
  isGameMasterTtsRequestEnabled,
  resetGameMasterTtsState,
  sanitizeTextForSay,
  speakGameMasterNarration,
  stopActiveGameMasterSay,
} from '../../server/src/gameMasterTts';

describe('gameMasterTts', () => {
  afterEach(() => {
    resetGameMasterTtsState();
  });

  it('isGameMasterTtsRequestEnabled requires env and client flag', () => {
    expect(isGameMasterTtsRequestEnabled(false, { GAME_MASTER_TTS: 'true' })).toBe(false);
    expect(isGameMasterTtsRequestEnabled(true, { GAME_MASTER_TTS: 'false' })).toBe(false);
    expect(isGameMasterTtsRequestEnabled(true, { GAME_MASTER_TTS: 'true' })).toBe(true);
  });

  it('isGameMasterTtsEnabled is false by default and true for explicit env', () => {
    expect(isGameMasterTtsEnabled({})).toBe(false);
    expect(isGameMasterTtsEnabled({ GAME_MASTER_TTS: 'false' })).toBe(false);
    expect(isGameMasterTtsEnabled({ GAME_MASTER_TTS: 'true' })).toBe(true);
    expect(isGameMasterTtsEnabled({ GAME_MASTER_TTS: '1' })).toBe(true);
    expect(isGameMasterTtsEnabled({ GAME_MASTER_TTS: 'yes' })).toBe(true);
  });

  it('sanitizeTextForSay trims long text to max chars', () => {
    const long = 'a'.repeat(GAME_MASTER_TTS_MAX_CHARS + 40);
    const trimmed = sanitizeTextForSay(long);
    expect(trimmed).not.toBeNull();
    expect(trimmed!.length).toBeLessThanOrEqual(GAME_MASTER_TTS_MAX_CHARS);
    expect(trimmed!.endsWith('…')).toBe(true);
  });

  it('sanitizeTextForSay returns null for empty or unsafe-only input', () => {
    expect(sanitizeTextForSay('   ')).toBeNull();
    expect(sanitizeTextForSay('"$`\\;|&<>')).toBeNull();
  });

  it('speakGameMasterNarration does not spawn say when TTS is disabled', () => {
    const spawnProcess = vi.fn();
    speakGameMasterNarration('Hola operador', 'ollama', {
      enabled: false,
      platform: 'darwin',
      spawnProcess,
    });
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it('speakGameMasterNarration does not spawn say when source is empty', () => {
    const spawnProcess = vi.fn();
    speakGameMasterNarration('Hola operador', '', {
      enabled: true,
      platform: 'darwin',
      spawnProcess,
    });
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it('speakGameMasterNarration spawns say on darwin when enabled', () => {
    const kill = vi.fn();
    const child = { kill, once: vi.fn(), on: vi.fn() };
    const spawnProcess = vi.fn().mockReturnValue(child);

    speakGameMasterNarration('  El pasillo respira.  ', 'fallback', {
      enabled: true,
      platform: 'darwin',
      spawnProcess,
    });

    expect(spawnProcess).toHaveBeenCalledWith('say', ['El pasillo respira.'], {
      stdio: 'ignore',
      detached: false,
    });
  });

  it('speakGameMasterNarration stops previous say before starting a new one', () => {
    const firstKill = vi.fn();
    const first = { kill: firstKill, once: vi.fn(), on: vi.fn() };
    const secondKill = vi.fn();
    const second = { kill: secondKill, once: vi.fn(), on: vi.fn() };
    const spawnProcess = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);

    speakGameMasterNarration('Primera línea', 'ollama', {
      enabled: true,
      platform: 'darwin',
      spawnProcess,
    });
    speakGameMasterNarration('Segunda línea', 'ollama', {
      enabled: true,
      platform: 'darwin',
      spawnProcess,
    });

    expect(firstKill).toHaveBeenCalledWith('SIGTERM');
    expect(spawnProcess).toHaveBeenCalledTimes(2);
  });

  it('speakGameMasterNarration does not throw when spawn fails', () => {
    const spawnProcess = vi.fn(() => {
      throw new Error('say missing');
    });

    expect(() =>
      speakGameMasterNarration('No debe romper', 'fallback', {
        enabled: true,
        platform: 'darwin',
        spawnProcess,
      }),
    ).not.toThrow();
  });

  it('stopActiveGameMasterSay is safe when nothing is speaking', () => {
    expect(() => stopActiveGameMasterSay()).not.toThrow();
  });
});
