export const GAME_MASTER_NARRATION_EVENTS = {
  boss_spawn: {
    minGapMs: 3_000,
    cooldownMs: 45_000,
    eventCooldownMs: 45_000,
  },
  low_health: {
    minGapMs: 8_000,
    cooldownMs: 22_000,
    eventCooldownMs: 22_000,
  },
  wave_clear: {
    minGapMs: 12_000,
    cooldownMs: 28_000,
    eventCooldownMs: 28_000,
  },
  player_death: {
    minGapMs: 0,
    cooldownMs: 0,
    eventCooldownMs: 120_000,
  },
  legendary_pickup: {
    minGapMs: 5_000,
    cooldownMs: 30_000,
    eventCooldownMs: 30_000,
  },
} as const;

export type GameMasterNarrationEventId = keyof typeof GAME_MASTER_NARRATION_EVENTS;

export const GAME_MASTER_MIN_REQUEST_GAP_MS = 3_000;

export const GAME_MASTER_EVENT_LABELS: Record<GameMasterNarrationEventId, string> = {
  boss_spawn: 'aparición de jefe',
  low_health: 'salud crítica',
  wave_clear: 'oleada contenida',
  player_death: 'señal del operador perdida',
  legendary_pickup: 'botín legendario',
};
