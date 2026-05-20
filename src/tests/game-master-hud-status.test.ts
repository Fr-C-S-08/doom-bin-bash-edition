import { describe, expect, it } from 'vitest';
import {
  formatGameMasterHudStatusLine,
  resolveGameMasterHudActivity,
} from '../game/raycast/GameMasterHudStatus';

describe('GameMasterHudStatus', () => {
  it('resolveGameMasterHudActivity reflects narration and in-flight state', () => {
    expect(resolveGameMasterHudActivity(false, false)).toBe('off');
    expect(resolveGameMasterHudActivity(true, false)).toBe('idle');
    expect(resolveGameMasterHudActivity(true, true)).toBe('pending');
  });

  it('formatGameMasterHudStatusLine includes voice and last source', () => {
    expect(
      formatGameMasterHudStatusLine({
        narrationEnabled: true,
        inFlight: false,
        voiceEnabled: true,
        lastSource: 'ollama',
      }),
    ).toBe('GM idle | voice on | src ollama');

    expect(
      formatGameMasterHudStatusLine({
        narrationEnabled: false,
        inFlight: true,
        voiceEnabled: false,
      }),
    ).toBe('GM off | voice off');
  });
});
