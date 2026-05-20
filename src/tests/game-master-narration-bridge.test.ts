import { describe, expect, it, vi } from 'vitest';
import {
  buildGameMasterNarrationContext,
  type GameMasterGameplaySnapshot,
} from '../services/gameMasterNarrationContext';
import {
  canRequestGameMasterNarration,
  createGameMasterNarrationThrottleState,
  GameMasterNarrationBridge,
  markGameMasterNarrationComplete,
  markGameMasterNarrationRequested,
} from '../services/gameMasterNarrationBridge';
import { GAME_MASTER_NARRATION_EVENTS } from '../services/gameMasterNarrationTypes';

const SNAPSHOT: GameMasterGameplaySnapshot = {
  levelId: 'volt-throne',
  levelName: 'Trono de Volt',
  worldSegment: 'world1',
  difficultyId: 'normal',
  playerHealthPercent: 100,
  equippedWeapon: 'rifle',
  activeEnemies: 2,
  survivalSeconds: 12,
  ammoLow: false,
  ammoPercent: 80,
  currentWave: 1,
  dangerLevel: 'elevated',
  directorState: 'WARNING',
  directorIntensityPercent: 35,
  nowMs: 10_000,
  bossDisplayName: 'Volt Archon',
  bossBehavior: 'volt-archon',
};

describe('gameMasterNarrationBridge', () => {
  it('canRequestGameMasterNarration blocks in-flight, duplicate keys and per-event cooldown', () => {
    const dedupeKey = 'boss_spawn:volt-throne:volt-archon';
    let state = createGameMasterNarrationThrottleState();

    expect(canRequestGameMasterNarration(state, 'boss_spawn', 20_000, dedupeKey)).toBe(true);

    state = { ...state, inFlight: true };
    expect(canRequestGameMasterNarration(state, 'boss_spawn', 20_000, dedupeKey)).toBe(false);

    const marked = markGameMasterNarrationRequested(
      createGameMasterNarrationThrottleState(),
      'boss_spawn',
      20_000,
      dedupeKey,
    );
    expect(marked.dedupeKeys[dedupeKey]).toBe(true);
    state = markGameMasterNarrationComplete(marked);
    expect(canRequestGameMasterNarration(state, 'boss_spawn', 50_000, dedupeKey)).toBe(false);

    state = createGameMasterNarrationThrottleState();
    state = {
      ...state,
      eventLastAtMs: { boss_spawn: 5_000 },
    };
    const cooldown = GAME_MASTER_NARRATION_EVENTS.boss_spawn.eventCooldownMs;
    expect(canRequestGameMasterNarration(state, 'boss_spawn', 5_000 + cooldown - 1, dedupeKey)).toBe(false);
    expect(canRequestGameMasterNarration(state, 'boss_spawn', 5_000 + cooldown, dedupeKey)).toBe(true);
  });

  it('requestEvent delivers async response without blocking caller', async () => {
    const deliver = vi.fn();
    const requestNarration = vi.fn().mockResolvedValue({
      message: 'El trono vibra. Dispara.',
      source: 'ollama' as const,
    });

    const bridge = new GameMasterNarrationBridge(deliver, { requestNarration, debug: false });
    bridge.requestEvent('boss_spawn', SNAPSHOT, { dedupeKey: 'boss_spawn:volt-throne:volt-archon' });

    expect(requestNarration).toHaveBeenCalledWith({
      context: buildGameMasterNarrationContext('boss_spawn', SNAPSHOT),
      event: 'boss_spawn',
    });
    expect(deliver).not.toHaveBeenCalled();

    await vi.waitFor(() =>
      expect(deliver).toHaveBeenCalledWith('El trono vibra. Dispara.', 'ollama', 'critical'),
    );
  });

  it('isNarrationInFlight reflects async request lifecycle', async () => {
    const deliver = vi.fn();
    let resolveRequest: (value: { message: string; source: 'ollama' }) => void = () => {};
    const requestNarration = vi.fn(
      () =>
        new Promise<{ message: string; source: 'ollama' }>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const bridge = new GameMasterNarrationBridge(deliver, { requestNarration });
    expect(bridge.isNarrationInFlight()).toBe(false);
    bridge.requestEvent('low_health', { ...SNAPSHOT, playerHealthPercent: 20 }, { dedupeKey: 'low_health:test:hp1' });
    expect(bridge.isNarrationInFlight()).toBe(true);
    resolveRequest({ message: 'ok', source: 'ollama' });
    await vi.waitFor(() => expect(bridge.isNarrationInFlight()).toBe(false));
  });

  it('requestEvent does not duplicate while in flight', async () => {
    const deliver = vi.fn();
    let resolveRequest: (value: { message: string; source: 'ollama' }) => void = () => {};
    const requestNarration = vi.fn(
      () =>
        new Promise<{ message: string; source: 'ollama' }>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const bridge = new GameMasterNarrationBridge(deliver, { requestNarration });
    const dedupeKey = 'low_health:volt-throne:hp2';
    bridge.requestEvent('low_health', { ...SNAPSHOT, playerHealthPercent: 28 }, { dedupeKey });
    bridge.requestEvent('low_health', { ...SNAPSHOT, playerHealthPercent: 25, nowMs: 10_500 }, { dedupeKey });

    expect(requestNarration).toHaveBeenCalledTimes(1);

    resolveRequest({ message: 'Aguanta.', source: 'ollama' });
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledOnce());
  });

  it('queues one high-priority event while narration is in flight', async () => {
    const deliver = vi.fn();
    let resolveFirst: (value: { message: string; source: 'ollama' }) => void = () => {};
    const requestNarration = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ message: string; source: 'ollama' }>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({ message: 'Crítico.', source: 'ollama' });

    const bridge = new GameMasterNarrationBridge(deliver, { requestNarration });
    bridge.requestEvent('pickup_key', SNAPSHOT, { dedupeKey: 'pickup_key:volt-throne:key-a' });
    bridge.requestEvent('low_health', { ...SNAPSHOT, playerHealthPercent: 18, nowMs: 14_000 }, {
      dedupeKey: 'low_health:volt-throne:hp1',
    });

    expect(requestNarration).toHaveBeenCalledTimes(1);

    resolveFirst({ message: 'Llave.', source: 'ollama' });
    await vi.waitFor(() => expect(requestNarration).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledTimes(2));
  });

  it('drops low-priority pickups while narration is in flight', async () => {
    const deliver = vi.fn();
    let resolveRequest: (value: { message: string; source: 'ollama' }) => void = () => {};
    const requestNarration = vi.fn(
      () =>
        new Promise<{ message: string; source: 'ollama' }>((resolve) => {
          resolveRequest = resolve;
        }),
    );

    const bridge = new GameMasterNarrationBridge(deliver, { requestNarration });
    bridge.requestEvent('boss_spawn', SNAPSHOT, { dedupeKey: 'boss_spawn:volt-throne:volt-archon' });
    bridge.requestEvent('pickup_health', SNAPSHOT, { dedupeKey: 'pickup_health:volt-throne:cell-a' });

    expect(requestNarration).toHaveBeenCalledTimes(1);

    resolveRequest({ message: 'Jefe.', source: 'ollama' });
    await vi.waitFor(() => expect(deliver).toHaveBeenCalledOnce());
  });
});
