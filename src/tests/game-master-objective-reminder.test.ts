import { describe, expect, it } from 'vitest';
import {
  buildGameMasterObjectiveReminderMessage,
  GM_OBJECTIVE_REMINDER_COOLDOWN_MS,
} from '../services/gameMasterObjectiveReminder';
import type { RaycastObjectiveState } from '../game/raycast/RaycastObjective';

function baseState(overrides: Partial<RaycastObjectiveState> = {}): RaycastObjectiveState {
  return {
    levelComplete: false,
    keyCount: 0,
    keyTotal: 1,
    closedDoorCount: 0,
    activatedTriggerCount: 0,
    requiredTriggerCount: 0,
    livingEnemyCount: 0,
    playerStationaryMs: 0,
    ...overrides,
  };
}

describe('game master objective reminder', () => {
  it('uses a 2s cooldown constant', () => {
    expect(GM_OBJECTIVE_REMINDER_COOLDOWN_MS).toBe(2000);
  });

  it('reminds key objective with chip progress', () => {
    const message = buildGameMasterObjectiveReminderMessage(
      baseState({ keyCount: 0, keyTotal: 2 }),
    );
    expect(message).toBe('Objetivo actual: consigue la llave de acceso. Fichas 0 de 2.');
  });

  it('reminds hostile elimination with remaining count', () => {
    const message = buildGameMasterObjectiveReminderMessage(
      baseState({
        keyCount: 1,
        keyTotal: 1,
        closedDoorCount: 0,
        livingEnemyCount: 3,
        requiredTriggerCount: 0,
      }),
    );
    expect(message).toBe('Objetivo actual: elimina a todos los hostiles. Quedan 3.');
  });

  it('reminds extraction when route is clear', () => {
    const message = buildGameMasterObjectiveReminderMessage(
      baseState({
        keyCount: 1,
        keyTotal: 1,
        closedDoorCount: 0,
        livingEnemyCount: 0,
        activatedTriggerCount: 1,
        requiredTriggerCount: 1,
      }),
    );
    expect(message).toBe('Objetivo actual: alcanza la extracción.');
  });

  it('falls back when objective state is ambiguous', () => {
    const message = buildGameMasterObjectiveReminderMessage(
      baseState({
        keyCount: 1,
        keyTotal: 1,
        closedDoorCount: 0,
        livingEnemyCount: 0,
        activatedTriggerCount: 0,
        requiredTriggerCount: 0,
        levelComplete: true,
      }),
    );
    expect(message).toContain('sector purgado');
  });
});
