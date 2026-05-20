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
} from './gameMasterClient';
import {
  GAME_MASTER_MIN_REQUEST_GAP_MS,
  GAME_MASTER_NARRATION_EVENTS,
  type GameMasterNarrationEventId,
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
  options: { minRequestGapMs?: number } = {},
): boolean {
  const minRequestGapMs = options.minRequestGapMs ?? GAME_MASTER_MIN_REQUEST_GAP_MS;
  const eventConfig = GAME_MASTER_NARRATION_EVENTS[eventId];

  if (state.inFlight) return false;
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

export class GameMasterNarrationBridge {
  private state = createGameMasterNarrationThrottleState();
  private readonly deliver: (message: string) => void;
  private readonly options: Required<Pick<GameMasterNarrationBridgeOptions, 'minRequestGapMs'>> &
    GameMasterNarrationBridgeOptions;

  constructor(
    deliver: (message: string) => void,
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
    const dedupeKey =
      requestOptions.dedupeKey ??
      buildGameMasterNarrationDedupeKey(eventId, snapshot, requestOptions.dedupeSuffix);

    if (
      !canRequestGameMasterNarration(this.state, eventId, snapshot.nowMs, dedupeKey, {
        minRequestGapMs: this.options.minRequestGapMs,
      })
    ) {
      this.logDebug('skipped', { eventId, dedupeKey, reason: 'throttle' });
      return;
    }

    this.state = markGameMasterNarrationRequested(this.state, eventId, snapshot.nowMs, dedupeKey);

    const request: GameMasterRequest = {
      context: buildGameMasterNarrationContext(eventId, snapshot),
      event: eventId,
    };

    const requestFn = this.options.requestNarration ?? requestNarration;
    this.logDebug('request', { eventId, dedupeKey });

    void requestFn(request)
      .then((response) => {
        this.logDebug('response', {
          eventId,
          source: response.source,
          preview: response.message.slice(0, 64),
        });
        this.deliver(response.message);
      })
      .catch(() => {
        const fallback = pickClientFallbackMessage(snapshot.nowMs);
        this.logDebug('fallback', { eventId, preview: fallback.slice(0, 64) });
        this.deliver(fallback);
      })
      .finally(() => {
        this.state = markGameMasterNarrationComplete(this.state);
      });
  }

  isNarrationInFlight(): boolean {
    return this.state.inFlight;
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
