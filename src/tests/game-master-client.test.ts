import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  GAME_MASTER_NARRATE_URL,
  pickClientFallbackMessage,
  requestNarration,
  type GameMasterResponse,
} from '../services/gameMasterClient';

describe('gameMasterClient', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pickClientFallbackMessage returns stable non-empty copy', () => {
    expect(pickClientFallbackMessage(0).length).toBeGreaterThan(8);
    expect(pickClientFallbackMessage(1)).not.toBe(pickClientFallbackMessage(0));
  });

  it('requestNarration posts context and event to the narrate endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        ({
          message: 'La puerta cede con un gemido metálico.',
          source: 'ollama',
        }) satisfies GameMasterResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestNarration({
      context: ' sector 2 ',
      event: ' llave roja ',
    });

    expect(result).toEqual({
      message: 'La puerta cede con un gemido metálico.',
      source: 'ollama',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      GAME_MASTER_NARRATE_URL,
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: 'sector 2',
          event: 'llave roja',
        }),
      }),
    );
  });

  it('requestNarration returns client fallback when response is not ok', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    );

    const result = await requestNarration({
      context: 'búnker',
      event: 'sin señal',
    });

    expect(result.source).toBe('fallback');
    expect(result.message.length).toBeGreaterThan(5);
  });

  it('requestNarration returns client fallback on invalid payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ message: '', source: 'ollama' }),
      }),
    );

    const result = await requestNarration({
      context: 'x',
      event: 'y',
    });

    expect(result.source).toBe('fallback');
  });

  it('requestNarration returns client fallback when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));

    const result = await requestNarration({
      context: 'sector',
      event: 'timeout',
    });

    expect(result.source).toBe('fallback');
    expect(result.message.length).toBeGreaterThan(5);
  });

  it('requestNarration includes tts when voice is requested', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () =>
        ({
          message: 'Voz activa.',
          source: 'fallback',
        }) satisfies GameMasterResponse,
    });
    vi.stubGlobal('fetch', fetchMock);

    await requestNarration({
      context: 'sector',
      event: 'test',
      tts: true,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      GAME_MASTER_NARRATE_URL,
      expect.objectContaining({
        body: JSON.stringify({
          context: 'sector',
          event: 'test',
          tts: true,
        }),
      }),
    );
  });

  it('requestNarration aborts on timeout', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              reject(new Error('aborted'));
            });
          }),
      ),
    );

    const result = await requestNarration(
      { context: 'a', event: 'b' },
      { timeoutMs: 20 },
    );

    expect(result.source).toBe('fallback');
  });
});
