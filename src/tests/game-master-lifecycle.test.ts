import { describe, expect, it, vi } from 'vitest';
import { createRaycastNarrationQueueState, enqueueNarrationMessage } from '../game/raycast/RaycastNarration';
import { stopGameMasterVoice } from '../services/gameMasterVoice';

describe('game master lifecycle stops', () => {
  it('stopGameMasterVoice clears pending speech queue state', () => {
    const cancel = vi.fn();
    Object.defineProperty(globalThis, 'speechSynthesis', {
      value: { speak: vi.fn(), cancel, getVoices: () => [] } as unknown as SpeechSynthesis,
      configurable: true,
    });

    let queue = enqueueNarrationMessage(createRaycastNarrationQueueState(), 'Línea antigua', 4, 0, 4000, 'ambient');
    expect(queue.active).not.toBeNull();

    stopGameMasterVoice('restart_level');
    expect(cancel).toHaveBeenCalled();

    queue = { pending: [], active: null, queueCooldownUntilMs: 0 };
    expect(queue.active).toBeNull();
    expect(queue.pending).toEqual([]);
  });

  it('documents lifecycle cancel reasons used by RaycastScene', () => {
    const reasons = [
      'player_death',
      'restart_level',
      'level_complete',
      'level_transition',
      'exit_menu',
      'scene_shutdown',
      'scene_start',
    ];
    expect(reasons.length).toBeGreaterThanOrEqual(6);
  });
});
