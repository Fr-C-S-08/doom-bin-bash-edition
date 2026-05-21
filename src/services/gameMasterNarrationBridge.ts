import {
  buildGameMasterNarrationContext,
  buildGameMasterNarrationDedupeKey,
  type GameMasterGameplaySnapshot,
} from './gameMasterNarrationContext';
import {
  pickClientFallbackMessage,
  requestNarration,
  type GameMasterRequest,
  type GameMasterResponse,
  type GameMasterSource,
} from './gameMasterClient';
import {
  GAME_MASTER_MIN_REQUEST_GAP_MS,
  GAME_MASTER_NARRATION_EVENTS,
  getGameMasterNarrationTier,
  shouldGameMasterTierPreempt,
  type GameMasterNarrationEventId,
  type GameMasterNarrationTier,
} from './gameMasterNarrationTypes';

/** @deprecated Use {@link GameMasterNarrationEventId} */
export const GAME_MASTER_BOSS_SPAWN_EVENT = 'boss_spawn' as const;
/** @deprecated Use event config in {@link GAME_MASTER_NARRATION_EVENTS} */
export const GAME_MASTER_BOSS_SPAWN_COOLDOWN_MS = GAME_MASTER_NARRATION_EVENTS.boss_spawn.cooldownMs;

export interface BossSpawnNarrationInput {
  levelId: string;
  levelName: string;
  bossId: string;
  bossDisplayName: string;
  bossBehavior: string;
  playerHealthPercent: number;
  difficultyId: string;
  directorIntensityPercent: number;
  worldSegment: string;
  twinBossPresent?: boolean;
  nowMs: number;
}

export interface GameMasterNarrationThrottleState {
  inFlight: boolean;
  lastRequestAtMs: number;
  eventLastAtMs: Record<string, number>;
  dedupeKeys: Record<string, true>;
}

export interface GameMasterNarrationBridgeOptions {
  debug?: boolean;
  minRequestGapMs?: number;
  requestNarration?: (request: GameMasterRequest) => Promise<GameMasterResponse>;
}

export interface GameMasterNarrationRequestOptions {
  dedupeKey?: string;
  dedupeSuffix?: string;
}

interface PendingGameMasterNarrationRequest {
  eventId: GameMasterNarrationEventId;
  snapshot: GameMasterGameplaySnapshot;
  requestOptions: GameMasterNarrationRequestOptions;
  tier: GameMasterNarrationTier;
}

export function createGameMasterNarrationThrottleState(): GameMasterNarrationThrottleState {
  return {
    inFlight: false,
    lastRequestAtMs: 0,
    eventLastAtMs: {},
    dedupeKeys: {},
  };
}

export function canRequestGameMasterNarration(
  state: GameMasterNarrationThrottleState,
  eventId: GameMasterNarrationEventId,
  nowMs: number,
  dedupeKey: string,
  options: { minRequestGapMs?: number; allowWhileInFlight?: boolean } = {},
): boolean {
  const minRequestGapMs = options.minRequestGapMs ?? GAME_MASTER_MIN_REQUEST_GAP_MS;
  const eventConfig = GAME_MASTER_NARRATION_EVENTS[eventId];

  if (state.inFlight && !options.allowWhileInFlight) return false;
  if (state.dedupeKeys[dedupeKey]) return false;
  if (state.lastRequestAtMs > 0 && nowMs - state.lastRequestAtMs < minRequestGapMs) return false;

  const lastEventAt = state.eventLastAtMs[eventId] ?? 0;
  if (lastEventAt > 0 && nowMs - lastEventAt < eventConfig.eventCooldownMs) return false;

  return true;
}

export function markGameMasterNarrationRequested(
  state: GameMasterNarrationThrottleState,
  eventId: GameMasterNarrationEventId,
  nowMs: number,
  dedupeKey: string,
): GameMasterNarrationThrottleState {
  return {
    ...state,
    inFlight: true,
    lastRequestAtMs: nowMs,
    eventLastAtMs: { ...state.eventLastAtMs, [eventId]: nowMs },
    dedupeKeys: { ...state.dedupeKeys, [dedupeKey]: true },
  };
}

export function markGameMasterNarrationComplete(
  state: GameMasterNarrationThrottleState,
): GameMasterNarrationThrottleState {
  return { ...state, inFlight: false };
}

/** @deprecated Prefer {@link buildGameMasterNarrationContext} */
export function buildBossSpawnNarrationKey(levelId: string, bossId: string): string {
  return `boss_spawn:${levelId}:${bossId}`;
}

/** @deprecated Prefer {@link buildGameMasterNarrationContext} */
export function buildBossSpawnNarrationContext(input: BossSpawnNarrationInput): string {
  return buildGameMasterNarrationContext('boss_spawn', {
    levelId: input.levelId,
    levelName: input.levelName,
    worldSegment: input.worldSegment,
    difficultyId: input.difficultyId,
    playerHealthPercent: input.playerHealthPercent,
    equippedWeapon: 'desconocida',
    activeEnemies: 0,
    survivalSeconds: 0,
    ammoLow: false,
    ammoPercent: 100,
    currentWave: 1,
    dangerLevel: 'elevated',
    directorState: null,
    directorIntensityPercent: input.directorIntensityPercent,
    nowMs: input.nowMs,
    bossDisplayName: input.bossDisplayName,
    bossBehavior: input.bossBehavior,
    twinBossPresent: input.twinBossPresent,
  });
}

/** @deprecated Prefer {@link canRequestGameMasterNarration} */
export function canRequestBossSpawnNarration(
  state: GameMasterNarrationThrottleState,
  nowMs: number,
  spawnKey: string,
  options: { cooldownMs?: number; minRequestGapMs?: number } = {},
): boolean {
  return canRequestGameMasterNarration(state, 'boss_spawn', nowMs, `boss_spawn:${spawnKey}`, {
    minRequestGapMs: options.minRequestGapMs,
  });
}

/** @deprecated Prefer {@link markGameMasterNarrationRequested} */
export function markBossSpawnNarrationRequested(
  state: GameMasterNarrationThrottleState,
  nowMs: number,
  spawnKey: string,
): GameMasterNarrationThrottleState {
  return markGameMasterNarrationRequested(state, 'boss_spawn', nowMs, `boss_spawn:${spawnKey}`);
}

/** @deprecated Prefer {@link markGameMasterNarrationComplete} */
export function markBossSpawnNarrationComplete(
  state: GameMasterNarrationThrottleState,
): GameMasterNarrationThrottleState {
  return markGameMasterNarrationComplete(state);
}

export type GameMasterNarrationDeliver = (
  message: string,
  source: GameMasterSource,
  tier: GameMasterNarrationTier,
) => void;

export class GameMasterNarrationBridge {
  private state = createGameMasterNarrationThrottleState();
  private pendingTiered: PendingGameMasterNarrationRequest[] = [];
  private lastHudTier: GameMasterNarrationTier | null = null;
  private readonly deliver: GameMasterNarrationDeliver;
  private readonly options: Required<Pick<GameMasterNarrationBridgeOptions, 'minRequestGapMs'>> &
    GameMasterNarrationBridgeOptions;

  constructor(
    deliver: GameMasterNarrationDeliver,
    options: GameMasterNarrationBridgeOptions = {},
  ) {
    this.deliver = deliver;
    this.options = {
      minRequestGapMs: options.minRequestGapMs ?? GAME_MASTER_MIN_REQUEST_GAP_MS,
      ...options,
    };
  }

  requestEvent(
    eventId: GameMasterNarrationEventId,
    snapshot: GameMasterGameplaySnapshot,
    requestOptions: GameMasterNarrationRequestOptions = {},
  ): void {
    const tier = getGameMasterNarrationTier(eventId);
    const dedupeKey =
      requestOptions.dedupeKey ??
      buildGameMasterNarrationDedupeKey(eventId, snapshot, requestOptions.dedupeSuffix);

    if (this.state.inFlight) {
      if (tier === 'ambient') {
        this.logDebug('skipped', { eventId, dedupeKey, reason: 'in_flight_ambient' });
        return;
      }
      this.queuePendingTiered({ eventId, snapshot, requestOptions: { ...requestOptions, dedupeKey }, tier });
      this.logDebug('queued', { eventId, dedupeKey, tier, reason: 'in_flight' });
      return;
    }

    if (
      !canRequestGameMasterNarration(this.state, eventId, snapshot.nowMs, dedupeKey, {
        minRequestGapMs: this.options.minRequestGapMs,
      })
    ) {
      if (tier !== 'ambient') {
        this.queuePendingTiered({ eventId, snapshot, requestOptions: { ...requestOptions, dedupeKey }, tier });
        this.logDebug('queued', { eventId, dedupeKey, tier, reason: 'throttle' });
      } else {
        this.logDebug('skipped', { eventId, dedupeKey, reason: 'throttle' });
      }
      return;
    }

    this.dispatchNarration(eventId, snapshot, { ...requestOptions, dedupeKey }, tier);
  }

  private queuePendingTiered(request: PendingGameMasterNarrationRequest): void {
    const withoutDisplaced = this.pendingTiered.filter((pending) => {
      if (request.tier === 'critical') return pending.tier !== 'ambient';
      if (request.tier === 'important' && pending.tier === 'ambient') return false;
      return true;
    });
    this.pendingTiered = [...withoutDisplaced, request].slice(-4);
  }

  private dispatchNarration(
    eventId: GameMasterNarrationEventId,
    snapshot: GameMasterGameplaySnapshot,
    requestOptions: GameMasterNarrationRequestOptions & { dedupeKey: string },
    tier: GameMasterNarrationTier,
  ): void {
    this.state = markGameMasterNarrationRequested(
      this.state,
      eventId,
      snapshot.nowMs,
      requestOptions.dedupeKey,
    );
    this.lastHudTier = tier;

    const request: GameMasterRequest = {
      context: buildGameMasterNarrationContext(eventId, snapshot),
      event: eventId,
    };

    const requestFn = this.options.requestNarration ?? requestNarration;
    this.logDebug('request', { eventId, tier, dedupeKey: requestOptions.dedupeKey });

    void requestFn(request)
      .then((response) => {
        this.logDebug('response', {
          eventId,
          tier,
          source: response.source,
          preview: response.message.slice(0, 64),
        });
        this.deliver(response.message, response.source, tier);
      })
      .catch(() => {
        const fallback = pickClientFallbackMessage(snapshot.nowMs);
        this.logDebug('fallback', { eventId, tier, preview: fallback.slice(0, 64) });
        this.deliver(fallback, 'fallback', tier);
      })
      .finally(() => {
        this.state = markGameMasterNarrationComplete(this.state);
        this.flushPendingTieredNarration();
      });
  }

  private flushPendingTieredNarration(): void {
    if (this.pendingTiered.length === 0) return;
    const next = pickHighestTierPending(this.pendingTiered);
    if (!next) return;
    this.pendingTiered = this.pendingTiered.filter((entry) => entry !== next);
    const dedupeKey =
      next.requestOptions.dedupeKey ??
      buildGameMasterNarrationDedupeKey(next.eventId, next.snapshot, next.requestOptions.dedupeSuffix);
    this.dispatchNarration(next.eventId, next.snapshot, { ...next.requestOptions, dedupeKey }, next.tier);
  }

  isNarrationInFlight(): boolean {
    return this.state.inFlight;
  }

  getLastHudTier(): GameMasterNarrationTier | null {
    return this.lastHudTier;
  }

  requestBossSpawnNarration(input: BossSpawnNarrationInput): void {
    this.requestEvent(
      'boss_spawn',
      {
        levelId: input.levelId,
        levelName: input.levelName,
        worldSegment: input.worldSegment,
        difficultyId: input.difficultyId,
        playerHealthPercent: input.playerHealthPercent,
        equippedWeapon: 'desconocida',
        activeEnemies: 0,
        survivalSeconds: 0,
        ammoLow: false,
        ammoPercent: 100,
        currentWave: 1,
        dangerLevel: 'elevated',
        directorState: null,
        directorIntensityPercent: input.directorIntensityPercent,
        nowMs: input.nowMs,
        bossDisplayName: input.bossDisplayName,
        bossBehavior: input.bossBehavior,
        twinBossPresent: input.twinBossPresent,
      },
      { dedupeKey: buildBossSpawnNarrationKey(input.levelId, input.bossId) },
    );
  }

  private logDebug(label: string, payload: Record<string, unknown>): void {
    if (!this.options.debug) return;
    console.debug(`[game-master] ${label}`, payload);
  }
}

function pickHighestTierPending(
  pending: PendingGameMasterNarrationRequest[],
): PendingGameMasterNarrationRequest | null {
  let best: PendingGameMasterNarrationRequest | null = null;
  for (const entry of pending) {
    if (!best || shouldGameMasterTierPreempt(entry.tier, best.tier)) {
      best = entry;
    }
  }
  return best;
}
