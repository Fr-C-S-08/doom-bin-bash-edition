import { afterEach, describe, expect, it, vi } from 'vitest';
import { PLAYER_DEATH_GM_MESSAGE } from '../services/gameMasterNarrationTypes';
import {
  resetGameMasterVoiceStateForTests,
  speakGameMasterVoice,
  stopGameMasterVoice,
} from '../services/gameMasterVoice';

describe('game master player death', () => {
  afterEach(() => {
    resetGameMasterVoiceStateForTests();
  });

  it('uses the fixed failure line for death narration', () => {
    expect(PLAYER_DEATH_GM_MESSAGE).toBe('Tenemos una baja. Misión fallida.');
  });

  it('critical death speech cancels prior audio and speaks the failure line', () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    class MockUtterance {
      rate = 1;
      pitch = 1;
      volume = 1;
      lang = '';
      constructor(public text: string) {}
    }
    globalThis.SpeechSynthesisUtterance = MockUtterance as unknown as typeof SpeechSynthesisUtterance;
    Object.defineProperty(globalThis, 'speechSynthesis', {
      value: { speak, cancel, getVoices: () => [] } as unknown as SpeechSynthesis,
      configurable: true,
    });

    speakGameMasterVoice('Mensaje ambiental largo que no debe continuar.', { tier: 'ambient' });
    expect(speak).toHaveBeenCalledTimes(1);

    const status = speakGameMasterVoice(PLAYER_DEATH_GM_MESSAGE, { tier: 'critical', urgent: true });
    expect(status).toBe('speaking');
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalledTimes(2);
    const deathUtterance = speak.mock.calls[1][0] as InstanceType<typeof MockUtterance>;
    expect(deathUtterance.text).toBe(PLAYER_DEATH_GM_MESSAGE);
  });

  it('stopGameMasterVoice clears synthesis before a new critical line', () => {
    const cancel = vi.fn();
    Object.defineProperty(globalThis, 'speechSynthesis', {
      value: { speak: vi.fn(), cancel, getVoices: () => [] } as unknown as SpeechSynthesis,
      configurable: true,
    });
    stopGameMasterVoice('player_death');
    expect(cancel).toHaveBeenCalled();
  });
});
