import { describe, expect, it } from 'vitest';
import { buildRaycastGameMasterSnapshot, formatWeaponForGameMaster } from '../game/raycast/RaycastGameMasterSnapshot';

describe('RaycastGameMasterSnapshot', () => {
  it('formatWeaponForGameMaster maps weapon kinds to Spanish labels', () => {
    expect(formatWeaponForGameMaster('SHOTGUN')).toBe('escopeta');
  });

  it('buildRaycastGameMasterSnapshot derives danger, ammo and survival telemetry', () => {
    const snapshot = buildRaycastGameMasterSnapshot({
      levelId: 'sector-a',
      levelName: 'Sector A',
      worldSegment: 'world2',
      difficultyId: 'hard',
      playerHealth: 18,
      playerMaxHealth: 100,
      equippedWeapon: 'PISTOL',
      activeEnemies: 6,
      runStartedAtMs: 0,
      ammoCurrent: 2,
      ammoCapacity: 20,
      currentWave: 4,
      directorState: 'AMBUSH',
      directorIntensityPercent: 80,
      nowMs: 125_000,
    });

    expect(snapshot.playerHealthPercent).toBe(18);
    expect(snapshot.ammoLow).toBe(true);
    expect(snapshot.survivalSeconds).toBe(125);
    expect(snapshot.dangerLevel).toBe('extreme');
    expect(snapshot.equippedWeapon).toBe('pistola');
  });
});
