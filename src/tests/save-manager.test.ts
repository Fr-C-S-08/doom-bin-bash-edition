import { describe, expect, it, beforeEach } from 'vitest';
import { SaveManager, resetSaveManagerForTests } from '../game/save/SaveManager';
import {
  LEGACY_SAVE_KEYS,
  SAVE_FORMAT_VERSION,
  SAVE_STORAGE_KEY,
  createDefaultSaveData,
  migrateSaveData,
  parseSaveJson,
  sanitizeSaveData
} from '../game/save/saveSchema';
import { RAYCAST_HIGH_SCORE_STORAGE_KEY } from '../game/raycast/RaycastScore';
import { RAYCAST_MASTERY_UNLOCK_STORAGE_KEY } from '../game/raycast/RaycastMasteryEnding';

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    key: (index) => [...map.keys()][index] ?? null,
    removeItem: (key) => {
      map.delete(key);
    },
    setItem: (key, value) => {
      map.set(key, value);
    }
  } as Storage;
}

describe('save manager', () => {
  let storage: Storage;

  beforeEach(() => {
    resetSaveManagerForTests();
    storage = memoryStorage();
  });

  it('returns defaults when storage is empty', () => {
    const manager = new SaveManager(storage);
    const data = manager.load();
    expect(data.version).toBe(SAVE_FORMAT_VERSION);
    expect(data.settings.masterVolume).toBeCloseTo(0.85);
    expect(data.progress.highScore).toBe(0);
  });

  it('persists and reloads a full save cycle', () => {
    const manager = new SaveManager(storage);
    manager.updateSettings({ masterVolume: 0.42, touchControlsEnabled: false });
    manager.updateProgress((progress) => ({ ...progress, highScore: 9001 }));
    expect(manager.save()).toBe(true);

    const reloaded = new SaveManager(storage).load();
    expect(reloaded.settings.masterVolume).toBeCloseTo(0.42);
    expect(reloaded.settings.touchControlsEnabled).toBe(false);
    expect(reloaded.progress.highScore).toBe(9001);
  });

  it('falls back to defaults on corrupted json', () => {
    storage.setItem(SAVE_STORAGE_KEY, '{not-json');
    const data = new SaveManager(storage).load();
    expect(data.progress.highScore).toBe(0);
    expect(data.settings.mouseSensitivity).toBe(1);
  });

  it('sanitizes partial corrupt payloads', () => {
    const sanitized = sanitizeSaveData({
      version: 99,
      settings: { masterVolume: 'bad', screenshake: false },
      progress: { highScore: -50, mastery: { trueSignalUnlocked: true } }
    });
    expect(sanitized.version).toBe(SAVE_FORMAT_VERSION);
    expect(sanitized.settings.masterVolume).toBeCloseTo(0.85);
    expect(sanitized.settings.screenshake).toBe(false);
    expect(sanitized.progress.highScore).toBe(0);
    expect(sanitized.progress.mastery.trueSignalUnlocked).toBe(true);
  });

  it('migrates legacy localStorage keys into unified save', () => {
    storage.setItem(LEGACY_SAVE_KEYS.highScore, '4200');
    storage.setItem(
      LEGACY_SAVE_KEYS.mastery,
      JSON.stringify({
        trueSignalUnlocked: true,
        corruptedSecretEndingUnlocked: false,
        impossibleModeUnlocked: false,
        hiddenFinalChallengeHookUnlocked: false,
        unlockedAtIso: null
      })
    );
    const manager = new SaveManager(storage);
    const data = manager.load();
    expect(data.progress.highScore).toBe(4200);
    expect(data.progress.mastery.trueSignalUnlocked).toBe(true);
    expect(storage.getItem(SAVE_STORAGE_KEY)).toBeTruthy();
  });

  it('exposes legacy adapter keys for existing score/mastery writers', () => {
    const manager = new SaveManager(storage);
    const adapter = manager.getLegacyStorageAdapter();
    adapter.setItem(RAYCAST_HIGH_SCORE_STORAGE_KEY, '1500');
    expect(adapter.getItem(RAYCAST_HIGH_SCORE_STORAGE_KEY)).toBe('1500');
    adapter.setItem(
      RAYCAST_MASTERY_UNLOCK_STORAGE_KEY,
      JSON.stringify({ ...createDefaultSaveData().progress.mastery, impossibleModeUnlocked: true })
    );
    expect(JSON.parse(adapter.getItem(RAYCAST_MASTERY_UNLOCK_STORAGE_KEY) ?? '{}').impossibleModeUnlocked).toBe(true);
  });

  it('records run outcomes into statistics and best runs', () => {
    const manager = new SaveManager(storage);
    manager.recordRunOutcome({
      levelId: 'sector-a',
      difficultyId: 'standard',
      outcome: 'clear',
      elapsedMs: 120000,
      score: 2200,
      rank: 'A',
      pelletsFired: 40,
      pelletsHitHostile: 30,
      enemiesKilled: 12,
      secretsFound: 1
    });
    const progress = manager.getProgress();
    expect(progress.statistics.totalRuns).toBe(1);
    expect(progress.statistics.totalClears).toBe(1);
    expect(progress.highScore).toBe(2200);
    expect(progress.bestRuns.some((run) => run.levelId === 'sector-a')).toBe(true);
    expect(progress.unlocks.clearedLevelIds).toContain('sector-a');
  });

  it('reset restores defaults', () => {
    const manager = new SaveManager(storage);
    manager.updateProgress((p) => ({ ...p, highScore: 999 }));
    manager.reset();
    expect(manager.getProgress().highScore).toBe(0);
  });

  it('migrateSaveData normalizes version', () => {
    expect(migrateSaveData({ ...createDefaultSaveData(), version: 0 }).version).toBe(SAVE_FORMAT_VERSION);
    expect(parseSaveJson(null).settings.touchLookSensitivity).toBe(1);
  });
});
