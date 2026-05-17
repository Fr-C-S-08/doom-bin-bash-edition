import { RAYCAST_HIGH_SCORE_STORAGE_KEY } from '../raycast/RaycastScore';
import { RAYCAST_MASTERY_UNLOCK_STORAGE_KEY } from '../raycast/RaycastMasteryEnding';
import { RAYCAST_PLAYTEST_TELEMETRY_STORAGE_KEY } from '../raycast/RaycastTelemetry';
import {
  applyRunOutcomeToProgress,
  createDefaultSaveData,
  importLegacySaveFragments,
  mergeSaveData,
  parseSaveJson,
  SAVE_STORAGE_KEY,
  type GameSaveData,
  type PersistedProgress,
  type PersistedSettings,
  type RecordRunOutcomeInput
} from './saveSchema';

export type SaveStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function createMemoryStorage(): SaveStorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    }
  };
}

function resolveBrowserStorage(): SaveStorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const probe = '__doom_save_probe__';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
    return localStorage;
  } catch {
    return null;
  }
}

export class SaveManager {
  private readonly storage: SaveStorageLike;
  private data: GameSaveData = createDefaultSaveData();
  private loaded = false;
  private persistEnabled = true;

  constructor(storage: SaveStorageLike | null = resolveBrowserStorage()) {
    this.storage = storage ?? createMemoryStorage();
  }

  load(): GameSaveData {
    if (this.loaded) return this.data;
    const raw = this.safeGetItem(SAVE_STORAGE_KEY);
    let data = parseSaveJson(raw);
    if (!raw) {
      const legacy = importLegacySaveFragments(this.storage);
      if (Object.keys(legacy).length > 0) {
        data = mergeSaveData(data, legacy);
        this.data = data;
        this.loaded = true;
        this.save();
        return this.data;
      }
    }
    this.data = data;
    this.loaded = true;
    return this.data;
  }

  save(): boolean {
    this.loaded = true;
    try {
      this.storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(this.data));
      return true;
    } catch {
      return false;
    }
  }

  reset(): GameSaveData {
    this.data = createDefaultSaveData();
    this.loaded = true;
    try {
      this.storage.removeItem(SAVE_STORAGE_KEY);
    } catch {
      // ignore
    }
    return this.data;
  }

  getData(): GameSaveData {
    return this.load();
  }

  getSettings(): PersistedSettings {
    return this.load().settings;
  }

  updateSettings(patch: Partial<PersistedSettings>): PersistedSettings {
    const data = this.load();
    data.settings = { ...data.settings, ...patch };
    this.save();
    return data.settings;
  }

  getProgress(): PersistedProgress {
    return this.load().progress;
  }

  updateProgress(mutator: (progress: PersistedProgress) => PersistedProgress): PersistedProgress {
    const data = this.load();
    data.progress = mutator(data.progress);
    this.save();
    return data.progress;
  }

  recordRunOutcome(input: RecordRunOutcomeInput): PersistedProgress {
    return this.updateProgress((progress) => applyRunOutcomeToProgress(progress, input));
  }

  setPersistEnabled(enabled: boolean): void {
    this.persistEnabled = enabled;
  }

  /** Maps legacy per-feature storage keys onto the unified save blob. */
  getLegacyStorageAdapter(): SaveStorageLike {
    return {
      getItem: (key) => this.legacyGetItem(key),
      setItem: (key, value) => {
        this.legacySetItem(key, value);
      },
      removeItem: (key) => {
        this.legacyRemoveItem(key);
      }
    };
  }

  private legacyGetItem(key: string): string | null {
    this.load();
    switch (key) {
      case RAYCAST_HIGH_SCORE_STORAGE_KEY:
        return String(Math.max(0, Math.floor(this.data.progress.highScore)));
      case RAYCAST_MASTERY_UNLOCK_STORAGE_KEY:
        return JSON.stringify(this.data.progress.mastery);
      case RAYCAST_PLAYTEST_TELEMETRY_STORAGE_KEY:
        return JSON.stringify(this.data.progress.playtestTelemetry);
      default:
        return this.safeGetItem(key);
    }
  }

  private legacySetItem(key: string, value: string): void {
    if (!this.persistEnabled) return;
    this.load();
    switch (key) {
      case RAYCAST_HIGH_SCORE_STORAGE_KEY: {
        const score = Number.parseInt(value, 10);
        if (Number.isFinite(score) && score >= 0) {
          this.data.progress.highScore = Math.max(this.data.progress.highScore, score);
          this.save();
        }
        return;
      }
      case RAYCAST_MASTERY_UNLOCK_STORAGE_KEY: {
        try {
          const parsed = JSON.parse(value) as PersistedProgress['mastery'];
          this.data.progress.mastery = { ...this.data.progress.mastery, ...parsed };
          this.save();
        } catch {
          // ignore corrupt writes
        }
        return;
      }
      case RAYCAST_PLAYTEST_TELEMETRY_STORAGE_KEY: {
        try {
          const parsed = JSON.parse(value);
          this.data.progress.playtestTelemetry = Array.isArray(parsed) ? parsed.slice(-64) : [];
          this.save();
        } catch {
          // ignore
        }
        return;
      }
      default:
        try {
          this.storage.setItem(key, value);
        } catch {
          // ignore
        }
    }
  }

  private legacyRemoveItem(key: string): void {
    switch (key) {
      case RAYCAST_HIGH_SCORE_STORAGE_KEY:
        this.data.progress.highScore = 0;
        this.save();
        return;
      case RAYCAST_MASTERY_UNLOCK_STORAGE_KEY:
        this.data.progress.mastery = createDefaultSaveData().progress.mastery;
        this.save();
        return;
      case RAYCAST_PLAYTEST_TELEMETRY_STORAGE_KEY:
        this.data.progress.playtestTelemetry = [];
        this.save();
        return;
      default:
        try {
          this.storage.removeItem(key);
        } catch {
          // ignore
        }
    }
  }

  private safeGetItem(key: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch {
      return null;
    }
  }
}

let defaultManager: SaveManager | null = null;

export function getSaveManager(): SaveManager {
  if (!defaultManager) defaultManager = new SaveManager();
  return defaultManager;
}

/** Vitest-only reset to avoid singleton bleed between suites. */
export function resetSaveManagerForTests(): void {
  defaultManager = null;
}

export function bootstrapGameSave(): GameSaveData {
  return getSaveManager().load();
}

export function getGameSaveStorage(): SaveStorageLike {
  return getSaveManager().getLegacyStorageAdapter();
}
