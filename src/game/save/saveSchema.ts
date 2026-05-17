import type { AimAssistLevel } from '../raycast/RaycastLookFeel';
import type { RaycastMasteryUnlockState } from '../raycast/RaycastMasteryEnding';
import type { RaycastPlaytestTelemetryRecord } from '../raycast/RaycastTelemetry';

export const SAVE_FORMAT_VERSION = 1;
export const SAVE_STORAGE_KEY = 'doom_bin_bash_save_v1';

/** Legacy keys migrated into the unified blob on first load. */
export const LEGACY_SAVE_KEYS = {
  highScore: 'raycast_high_score_v1',
  mastery: 'raycast_mastery_unlock_v1',
  telemetry: 'raycast_playtest_telemetry_v1'
} as const;

export interface PersistedSettings {
  mouseSensitivity: number;
  gamepadSensitivity: number;
  gamepadLeftDeadzone: number;
  gamepadRightDeadzone: number;
  gamepadInvertY: boolean;
  gamepadVibration: boolean;
  screenshake: boolean;
  minimapDefaultVisible: boolean;
  masterVolume: number;
  touchControlsEnabled: boolean;
  touchLookSensitivity: number;
  touchButtonScale: number;
  touchJoystickDeadzone: number;
  preferFullscreen: boolean;
  aimAssist: AimAssistLevel;
  cameraSmoothing: number;
}

export interface RaycastStatistics {
  totalRuns: number;
  totalClears: number;
  totalDeaths: number;
  totalPlayTimeMs: number;
  totalScore: number;
  pelletsFired: number;
  pelletsHitHostile: number;
  enemiesKilled: number;
  secretsFound: number;
}

export interface RaycastUnlocks {
  clearedLevelIds: string[];
  masteryFlags: string[];
}

export interface RaycastBestRun {
  levelId: string;
  difficultyId: string;
  score: number;
  rank: string;
  elapsedMs: number;
  recordedAtIso: string;
}

export interface RaycastChallengeRecord {
  challengeId: string;
  bestScore: number;
  bestTimeMs: number;
  recordedAtIso: string;
}

export interface PersistedProgress {
  highScore: number;
  mastery: RaycastMasteryUnlockState;
  statistics: RaycastStatistics;
  unlocks: RaycastUnlocks;
  bestRuns: RaycastBestRun[];
  challengeRecords: RaycastChallengeRecord[];
  playtestTelemetry: RaycastPlaytestTelemetryRecord[];
}

export interface GameSaveData {
  version: number;
  settings: PersistedSettings;
  progress: PersistedProgress;
}

export interface RecordRunOutcomeInput {
  levelId: string;
  difficultyId: string;
  outcome: 'clear' | 'death';
  elapsedMs: number;
  score: number;
  rank?: string;
  pelletsFired?: number;
  pelletsHitHostile?: number;
  enemiesKilled?: number;
  secretsFound?: number;
}

export function createDefaultSettings(): PersistedSettings {
  return {
    mouseSensitivity: 1,
    gamepadSensitivity: 1,
    gamepadLeftDeadzone: 0.18,
    gamepadRightDeadzone: 0.18,
    gamepadInvertY: false,
    gamepadVibration: false,
    screenshake: true,
    minimapDefaultVisible: true,
    masterVolume: 0.85,
    touchControlsEnabled: true,
    touchLookSensitivity: 1,
    touchButtonScale: 1,
    touchJoystickDeadzone: 0.18,
    preferFullscreen: false,
    aimAssist: 'low',
    cameraSmoothing: 0.2
  };
}

export function createDefaultStatistics(): RaycastStatistics {
  return {
    totalRuns: 0,
    totalClears: 0,
    totalDeaths: 0,
    totalPlayTimeMs: 0,
    totalScore: 0,
    pelletsFired: 0,
    pelletsHitHostile: 0,
    enemiesKilled: 0,
    secretsFound: 0
  };
}

export function createDefaultMastery(): RaycastMasteryUnlockState {
  return {
    trueSignalUnlocked: false,
    corruptedSecretEndingUnlocked: false,
    impossibleModeUnlocked: false,
    hiddenFinalChallengeHookUnlocked: false,
    unlockedAtIso: null
  };
}

export function createDefaultProgress(): PersistedProgress {
  return {
    highScore: 0,
    mastery: createDefaultMastery(),
    statistics: createDefaultStatistics(),
    unlocks: { clearedLevelIds: [], masteryFlags: [] },
    bestRuns: [],
    challengeRecords: [],
    playtestTelemetry: []
  };
}

export function createDefaultSaveData(): GameSaveData {
  return {
    version: SAVE_FORMAT_VERSION,
    settings: createDefaultSettings(),
    progress: createDefaultProgress()
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function sanitizeMastery(value: unknown): RaycastMasteryUnlockState {
  if (!isRecord(value)) return createDefaultMastery();
  return {
    trueSignalUnlocked: Boolean(value.trueSignalUnlocked),
    corruptedSecretEndingUnlocked: Boolean(value.corruptedSecretEndingUnlocked),
    impossibleModeUnlocked: Boolean(value.impossibleModeUnlocked),
    hiddenFinalChallengeHookUnlocked: Boolean(value.hiddenFinalChallengeHookUnlocked),
    unlockedAtIso: typeof value.unlockedAtIso === 'string' ? value.unlockedAtIso : null
  };
}

function sanitizeStatistics(value: unknown): RaycastStatistics {
  if (!isRecord(value)) return createDefaultStatistics();
  const defaults = createDefaultStatistics();
  return {
    totalRuns: Math.max(0, Math.floor(readNumber(value.totalRuns, defaults.totalRuns))),
    totalClears: Math.max(0, Math.floor(readNumber(value.totalClears, defaults.totalClears))),
    totalDeaths: Math.max(0, Math.floor(readNumber(value.totalDeaths, defaults.totalDeaths))),
    totalPlayTimeMs: Math.max(0, Math.floor(readNumber(value.totalPlayTimeMs, defaults.totalPlayTimeMs))),
    totalScore: Math.max(0, Math.floor(readNumber(value.totalScore, defaults.totalScore))),
    pelletsFired: Math.max(0, Math.floor(readNumber(value.pelletsFired, defaults.pelletsFired))),
    pelletsHitHostile: Math.max(0, Math.floor(readNumber(value.pelletsHitHostile, defaults.pelletsHitHostile))),
    enemiesKilled: Math.max(0, Math.floor(readNumber(value.enemiesKilled, defaults.enemiesKilled))),
    secretsFound: Math.max(0, Math.floor(readNumber(value.secretsFound, defaults.secretsFound)))
  };
}

function sanitizeSettings(value: unknown): PersistedSettings {
  const defaults = createDefaultSettings();
  if (!isRecord(value)) return defaults;
  return {
    mouseSensitivity: readNumber(value.mouseSensitivity, defaults.mouseSensitivity),
    gamepadSensitivity: readNumber(value.gamepadSensitivity, defaults.gamepadSensitivity),
    gamepadLeftDeadzone: readNumber(value.gamepadLeftDeadzone, defaults.gamepadLeftDeadzone),
    gamepadRightDeadzone: readNumber(value.gamepadRightDeadzone, defaults.gamepadRightDeadzone),
    gamepadInvertY: readBoolean(value.gamepadInvertY, defaults.gamepadInvertY),
    gamepadVibration: readBoolean(value.gamepadVibration, defaults.gamepadVibration),
    screenshake: value.screenshake === false ? false : defaults.screenshake,
    minimapDefaultVisible: value.minimapDefaultVisible === false ? false : defaults.minimapDefaultVisible,
    masterVolume: readNumber(value.masterVolume, defaults.masterVolume),
    touchControlsEnabled: value.touchControlsEnabled === false ? false : defaults.touchControlsEnabled,
    touchLookSensitivity: readNumber(value.touchLookSensitivity, defaults.touchLookSensitivity),
    touchButtonScale: readNumber(value.touchButtonScale, defaults.touchButtonScale),
    touchJoystickDeadzone: readNumber(value.touchJoystickDeadzone, defaults.touchJoystickDeadzone),
    preferFullscreen: readBoolean(value.preferFullscreen, defaults.preferFullscreen),
    aimAssist:
      value.aimAssist === 'off' || value.aimAssist === 'low' || value.aimAssist === 'normal'
        ? value.aimAssist
        : defaults.aimAssist,
    cameraSmoothing: Math.min(0.85, Math.max(0, readNumber(value.cameraSmoothing, defaults.cameraSmoothing)))
  };
}

function sanitizeBestRuns(value: unknown): RaycastBestRun[] {
  if (!Array.isArray(value)) return [];
  const runs: RaycastBestRun[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) continue;
    if (typeof entry.levelId !== 'string' || typeof entry.difficultyId !== 'string') continue;
    runs.push({
      levelId: entry.levelId,
      difficultyId: entry.difficultyId,
      score: Math.max(0, Math.floor(readNumber(entry.score, 0))),
      rank: typeof entry.rank === 'string' ? entry.rank : 'C',
      elapsedMs: Math.max(0, Math.floor(readNumber(entry.elapsedMs, 0))),
      recordedAtIso: typeof entry.recordedAtIso === 'string' ? entry.recordedAtIso : new Date().toISOString()
    });
  }
  return runs.slice(-128);
}

function sanitizeChallengeRecords(value: unknown): RaycastChallengeRecord[] {
  if (!Array.isArray(value)) return [];
  const records: RaycastChallengeRecord[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.challengeId !== 'string') continue;
    records.push({
      challengeId: entry.challengeId,
      bestScore: Math.max(0, Math.floor(readNumber(entry.bestScore, 0))),
      bestTimeMs: Math.max(0, Math.floor(readNumber(entry.bestTimeMs, 0))),
      recordedAtIso: typeof entry.recordedAtIso === 'string' ? entry.recordedAtIso : new Date().toISOString()
    });
  }
  return records.slice(-64);
}

function sanitizeTelemetry(value: unknown): RaycastPlaytestTelemetryRecord[] {
  return Array.isArray(value) ? (value as RaycastPlaytestTelemetryRecord[]).slice(-64) : [];
}

export function sanitizeSaveData(raw: unknown): GameSaveData {
  const defaults = createDefaultSaveData();
  if (!isRecord(raw)) return defaults;
  const progressRaw = isRecord(raw.progress) ? raw.progress : {};
  const unlocksRaw = isRecord(progressRaw.unlocks) ? progressRaw.unlocks : {};
  return {
    version: SAVE_FORMAT_VERSION,
    settings: sanitizeSettings(raw.settings),
    progress: {
      highScore: Math.max(0, Math.floor(readNumber(progressRaw.highScore, 0))),
      mastery: sanitizeMastery(progressRaw.mastery),
      statistics: sanitizeStatistics(progressRaw.statistics),
      unlocks: {
        clearedLevelIds: Array.isArray(unlocksRaw.clearedLevelIds)
          ? unlocksRaw.clearedLevelIds.filter((id): id is string => typeof id === 'string').slice(-256)
          : [],
        masteryFlags: Array.isArray(unlocksRaw.masteryFlags)
          ? unlocksRaw.masteryFlags.filter((id): id is string => typeof id === 'string').slice(-32)
          : []
      },
      bestRuns: sanitizeBestRuns(progressRaw.bestRuns),
      challengeRecords: sanitizeChallengeRecords(progressRaw.challengeRecords),
      playtestTelemetry: sanitizeTelemetry(progressRaw.playtestTelemetry)
    }
  };
}

export function migrateSaveData(data: GameSaveData): GameSaveData {
  let next = sanitizeSaveData(data);
  if (next.version < SAVE_FORMAT_VERSION) {
    next = { ...next, version: SAVE_FORMAT_VERSION };
  }
  return next;
}

export function parseSaveJson(raw: string | null): GameSaveData {
  if (!raw) return createDefaultSaveData();
  try {
    return migrateSaveData(sanitizeSaveData(JSON.parse(raw) as unknown));
  } catch {
    return createDefaultSaveData();
  }
}

export interface LegacyStorageReader {
  getItem(key: string): string | null;
}

export function importLegacySaveFragments(reader: LegacyStorageReader): Partial<GameSaveData> {
  const progressPatch: Partial<PersistedProgress> = {};
  let hasProgress = false;

  try {
    const highRaw = reader.getItem(LEGACY_SAVE_KEYS.highScore);
    if (highRaw) {
      const n = Number.parseInt(highRaw, 10);
      if (Number.isFinite(n) && n >= 0) {
        progressPatch.highScore = n;
        hasProgress = true;
      }
    }
  } catch {
    // ignore
  }
  try {
    const masteryRaw = reader.getItem(LEGACY_SAVE_KEYS.mastery);
    if (masteryRaw) {
      progressPatch.mastery = sanitizeMastery(JSON.parse(masteryRaw));
      hasProgress = true;
    }
  } catch {
    // ignore
  }
  try {
    const telemetryRaw = reader.getItem(LEGACY_SAVE_KEYS.telemetry);
    if (telemetryRaw) {
      progressPatch.playtestTelemetry = sanitizeTelemetry(JSON.parse(telemetryRaw));
      hasProgress = true;
    }
  } catch {
    // ignore
  }

  if (!hasProgress) return {};
  return {
    progress: {
      ...createDefaultProgress(),
      ...progressPatch,
      mastery: progressPatch.mastery ?? createDefaultMastery(),
      statistics: createDefaultStatistics(),
      unlocks: createDefaultProgress().unlocks,
      bestRuns: progressPatch.bestRuns ?? [],
      challengeRecords: progressPatch.challengeRecords ?? [],
      playtestTelemetry: progressPatch.playtestTelemetry ?? []
    }
  };
}

export function mergeSaveData(base: GameSaveData, patch: Partial<GameSaveData>): GameSaveData {
  return migrateSaveData({
    version: SAVE_FORMAT_VERSION,
    settings: { ...base.settings, ...patch.settings },
    progress: {
      ...base.progress,
      ...patch.progress,
      mastery: { ...base.progress.mastery, ...patch.progress?.mastery },
      statistics: { ...base.progress.statistics, ...patch.progress?.statistics },
      unlocks: {
        clearedLevelIds: patch.progress?.unlocks?.clearedLevelIds ?? base.progress.unlocks.clearedLevelIds,
        masteryFlags: patch.progress?.unlocks?.masteryFlags ?? base.progress.unlocks.masteryFlags
      },
      bestRuns: patch.progress?.bestRuns ?? base.progress.bestRuns,
      challengeRecords: patch.progress?.challengeRecords ?? base.progress.challengeRecords,
      playtestTelemetry: patch.progress?.playtestTelemetry ?? base.progress.playtestTelemetry
    }
  });
}

export function applyRunOutcomeToProgress(progress: PersistedProgress, input: RecordRunOutcomeInput): PersistedProgress {
  const nextStats = { ...progress.statistics };
  nextStats.totalRuns += 1;
  nextStats.totalPlayTimeMs += Math.max(0, Math.floor(input.elapsedMs));
  nextStats.totalScore += Math.max(0, Math.floor(input.score));
  nextStats.pelletsFired += Math.max(0, Math.floor(input.pelletsFired ?? 0));
  nextStats.pelletsHitHostile += Math.max(0, Math.floor(input.pelletsHitHostile ?? 0));
  nextStats.enemiesKilled += Math.max(0, Math.floor(input.enemiesKilled ?? 0));
  nextStats.secretsFound += Math.max(0, Math.floor(input.secretsFound ?? 0));
  if (input.outcome === 'clear') nextStats.totalClears += 1;
  if (input.outcome === 'death') nextStats.totalDeaths += 1;

  const highScore = Math.max(progress.highScore, Math.max(0, Math.floor(input.score)));
  const clearedLevelIds = new Set(progress.unlocks.clearedLevelIds);
  if (input.outcome === 'clear') clearedLevelIds.add(input.levelId);

  const bestRuns = [...progress.bestRuns];
  if (input.outcome === 'clear') {
    const existing = bestRuns.find((run) => run.levelId === input.levelId && run.difficultyId === input.difficultyId);
    const candidate: RaycastBestRun = {
      levelId: input.levelId,
      difficultyId: input.difficultyId,
      score: Math.max(0, Math.floor(input.score)),
      rank: input.rank ?? 'C',
      elapsedMs: Math.max(0, Math.floor(input.elapsedMs)),
      recordedAtIso: new Date().toISOString()
    };
    if (!existing || candidate.score > existing.score || (candidate.score === existing.score && candidate.elapsedMs < existing.elapsedMs)) {
      const without = bestRuns.filter((run) => !(run.levelId === input.levelId && run.difficultyId === input.difficultyId));
      bestRuns.splice(0, bestRuns.length, ...without, candidate);
    }
  }

  const challengeId = `${input.levelId}:${input.difficultyId}`;
  const challengeRecords = [...progress.challengeRecords];
  const challengeIdx = challengeRecords.findIndex((record) => record.challengeId === challengeId);
  const challengeCandidate: RaycastChallengeRecord = {
    challengeId,
    bestScore: Math.max(0, Math.floor(input.score)),
    bestTimeMs: input.outcome === 'clear' ? Math.max(0, Math.floor(input.elapsedMs)) : Number.MAX_SAFE_INTEGER,
    recordedAtIso: new Date().toISOString()
  };
  if (challengeIdx < 0) {
    challengeRecords.push(challengeCandidate);
  } else {
    const prev = challengeRecords[challengeIdx];
    challengeRecords[challengeIdx] = {
      ...prev,
      bestScore: Math.max(prev.bestScore, challengeCandidate.bestScore),
      bestTimeMs:
        input.outcome === 'clear' ? Math.min(prev.bestTimeMs, challengeCandidate.bestTimeMs) : prev.bestTimeMs,
      recordedAtIso: challengeCandidate.recordedAtIso
    };
  }

  return {
    ...progress,
    highScore,
    statistics: nextStats,
    unlocks: { ...progress.unlocks, clearedLevelIds: [...clearedLevelIds] },
    bestRuns: bestRuns.slice(-128),
    challengeRecords: challengeRecords.slice(-64)
  };
}
