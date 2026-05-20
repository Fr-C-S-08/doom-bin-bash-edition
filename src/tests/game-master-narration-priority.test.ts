import { describe, expect, it } from 'vitest';
import {
  enqueueNarrationMessage,
  createRaycastNarrationQueueState,
} from '../game/raycast/RaycastNarration';
import {
  getGameMasterNarrationTier,
  shouldGameMasterTierPreempt,
  GAME_MASTER_TIER_RANK,
} from '../services/gameMasterNarrationTypes';

describe('game master narration priority', () => {
  it('maps boss spawn and low health to critical tier', () => {
    expect(getGameMasterNarrationTier('boss_spawn')).toBe('critical');
    expect(getGameMasterNarrationTier('low_health')).toBe('critical');
    expect(getGameMasterNarrationTier('pickup_ammo')).toBe('ambient');
  });

  it('critical narration preempts active ambient overlay', () => {
    const active = {
      message: 'Ambiente',
      pages: ['Ambiente'],
      pageIndex: 0,
      tier: 'ambient' as const,
      phase: 'hold' as const,
      phaseStartedAtMs: 1,
      displayMs: 3_000,
      typewriterStartedAtMs: 1,
    };
    const state = enqueueNarrationMessage(
      { pending: [], active, queueCooldownUntilMs: 0 },
      '¡Jefe detectado!',
      4,
      2_000,
      4_000,
      'critical',
    );
    expect(state.active?.message).toBe('¡Jefe detectado!');
    expect(state.active?.tier).toBe('critical');
    expect(state.pending).toEqual([]);
  });

  it('tier rank allows critical to preempt ambient', () => {
    expect(GAME_MASTER_TIER_RANK.critical).toBeGreaterThan(GAME_MASTER_TIER_RANK.ambient);
    expect(shouldGameMasterTierPreempt('critical', 'ambient')).toBe(true);
    expect(shouldGameMasterTierPreempt('ambient', 'critical')).toBe(false);
  });

  it('starts idle queue with ambient tier by default', () => {
    const state = enqueueNarrationMessage(createRaycastNarrationQueueState(), 'Exploración tranquila.');
    expect(state.active?.tier).toBe('ambient');
  });
});
