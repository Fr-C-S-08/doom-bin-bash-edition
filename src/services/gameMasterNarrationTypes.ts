/** @deprecated Use {@link GameMasterNarrationTier} */
export type GameMasterNarrationPriority = 'high' | 'medium' | 'low';

export type GameMasterNarrationTier = 'critical' | 'important' | 'ambient';

export interface GameMasterNarrationEventConfig {
  minGapMs: number;
  cooldownMs: number;
  eventCooldownMs: number;
  /** @deprecated Use {@link tier} */
  priority: GameMasterNarrationPriority;
  tier: GameMasterNarrationTier;
}

export const GAME_MASTER_NARRATION_EVENTS = {
  boss_spawn: {
    minGapMs: 3_000,
    cooldownMs: 45_000,
    eventCooldownMs: 45_000,
    priority: 'high',
    tier: 'critical',
  },
  low_health: {
    minGapMs: 8_000,
    cooldownMs: 22_000,
    eventCooldownMs: 22_000,
    priority: 'high',
    tier: 'critical',
  },
  player_death: {
    minGapMs: 0,
    cooldownMs: 0,
    eventCooldownMs: 120_000,
    priority: 'high',
    tier: 'critical',
  },
  objective_complete: {
    minGapMs: 4_000,
    cooldownMs: 60_000,
    eventCooldownMs: 90_000,
    priority: 'high',
    tier: 'critical',
  },
  door_opened: {
    minGapMs: 5_000,
    cooldownMs: 18_000,
    eventCooldownMs: 20_000,
    priority: 'medium',
    tier: 'important',
  },
  secret_found: {
    minGapMs: 6_000,
    cooldownMs: 30_000,
    eventCooldownMs: 35_000,
    priority: 'medium',
    tier: 'important',
  },
  wave_clear: {
    minGapMs: 12_000,
    cooldownMs: 28_000,
    eventCooldownMs: 28_000,
    priority: 'medium',
    tier: 'important',
  },
  legendary_pickup: {
    minGapMs: 5_000,
    cooldownMs: 30_000,
    eventCooldownMs: 30_000,
    priority: 'medium',
    tier: 'important',
  },
  pickup_key: {
    minGapMs: 8_000,
    cooldownMs: 24_000,
    eventCooldownMs: 28_000,
    priority: 'medium',
    tier: 'important',
  },
  pickup_health: {
    minGapMs: 10_000,
    cooldownMs: 20_000,
    eventCooldownMs: 24_000,
    priority: 'low',
    tier: 'ambient',
  },
  pickup_ammo: {
    minGapMs: 10_000,
    cooldownMs: 18_000,
    eventCooldownMs: 22_000,
    priority: 'low',
    tier: 'ambient',
  },
  manual_debug: {
    minGapMs: 0,
    cooldownMs: 0,
    eventCooldownMs: 0,
    priority: 'medium',
    tier: 'important',
  },
} as const satisfies Record<string, GameMasterNarrationEventConfig>;

export type GameMasterNarrationEventId = keyof typeof GAME_MASTER_NARRATION_EVENTS;

export const GAME_MASTER_MIN_REQUEST_GAP_MS = 3_000;

export const GAME_MASTER_TIER_RANK: Record<GameMasterNarrationTier, number> = {
  critical: 3,
  important: 2,
  ambient: 1,
};

export const GAME_MASTER_EVENT_LABELS: Record<GameMasterNarrationEventId, string> = {
  boss_spawn: 'aparición de jefe',
  low_health: 'salud crítica',
  wave_clear: 'oleada contenida',
  player_death: 'señal del operador perdida',
  legendary_pickup: 'botín legendario',
  objective_complete: 'objetivo cumplido',
  door_opened: 'puerta desbloqueada',
  secret_found: 'secreto hallado',
  pickup_key: 'ficha recuperada',
  pickup_health: 'célula de reparación',
  pickup_ammo: 'munición reabastecida',
  manual_debug: 'prueba manual (tecla G)',
};

export function getGameMasterNarrationPriority(
  eventId: GameMasterNarrationEventId,
): GameMasterNarrationPriority {
  return GAME_MASTER_NARRATION_EVENTS[eventId].priority;
}

export function getGameMasterNarrationTier(eventId: GameMasterNarrationEventId): GameMasterNarrationTier {
  return GAME_MASTER_NARRATION_EVENTS[eventId].tier;
}

export function shouldGameMasterTierPreempt(
  incoming: GameMasterNarrationTier,
  current: GameMasterNarrationTier | null,
): boolean {
  if (!current) return true;
  return GAME_MASTER_TIER_RANK[incoming] > GAME_MASTER_TIER_RANK[current];
}

export function formatGameMasterTierHudLabel(tier: GameMasterNarrationTier | null): string {
  if (!tier) return 'idle';
  return tier;
}
