import { describe, expect, it } from 'vitest';
import type { RaycastEnemy } from '../game/raycast/RaycastEnemy';
import {
  RAYCAST_BOSS_KILL_FREEZE_MS,
  RAYCAST_KILL_FREEZE_MS,
  applyWeaponFireFeel,
  applyWeaponSwitchFeel,
  buildWeaponViewFeel,
  createCombatFeelRuntimeState,
  getCorpseFadeAlpha,
  getDeathFeedbackProfile,
  getHitMarkerFeedbackTiming,
  getRecoilBounds,
  getWeaponFeelProfile,
  shouldSkipGameplayDuringFreeze,
  tickCombatFeelRuntime
} from '../game/raycast/RaycastCombatFeel';

function mockEnemy(overrides: Partial<RaycastEnemy> = {}): RaycastEnemy {
  return {
    id: 'e1',
    kind: 'GRUNT',
    x: 1,
    y: 1,
    health: 0,
    maxHealth: 10,
    alive: false,
    radius: 0.3,
    color: 0xff0000,
    lastAttack: 0,
    spawnTelegraphStartedAt: 0,
    spawnTelegraphUntil: 0,
    attackWindupStartedAt: 0,
    attackWindupUntil: 0,
    staggerUntil: 0,
    hitFlashUntil: 0,
    flinchOffsetRad: 0,
    deathBurstUntil: 1000,
    patrolWaypoints: [],
    patrolWaypointIndex: 0,
    alertUntilTime: 0,
    lastKnownPlayerX: 0,
    lastKnownPlayerY: 0,
    wasCombatActiveLastTick: false,
    roamHeadingRad: 0,
    roamNextRedirectAt: 0,
    roamStuckMs: 0,
    ...overrides
  };
}

describe('raycast combat feel', () => {
  it('keeps recoil within per-weapon bounds', () => {
    const state = createCombatFeelRuntimeState();
    const bounds = getRecoilBounds('SHOTGUN');
    applyWeaponFireFeel(state, 'SHOTGUN', 0);
    applyWeaponFireFeel(state, 'SHOTGUN', 16);
    expect(state.recoilKick).toBeGreaterThan(0);
    expect(state.recoilKick).toBeLessThanOrEqual(bounds.max);
    tickCombatFeelRuntime(state, 200, 0.5, false, 'SHOTGUN', 0);
    expect(state.recoilKick).toBeLessThan(bounds.max);
  });

  it('recovers recoil and completes weapon switch transitions', () => {
    const state = createCombatFeelRuntimeState();
    applyWeaponSwitchFeel(state, 'PISTOL', 'LAUNCHER', 1000);
    expect(state.switchBlend).toBe(1);
    tickCombatFeelRuntime(state, 1100, 1 / 60, true, 'LAUNCHER', 0);
    expect(state.switchBlend).toBeLessThan(1);
    tickCombatFeelRuntime(state, 1400, 1 / 60, true, 'LAUNCHER', 0);
    expect(state.switchBlend).toBe(0);
  });

  it('builds distinct weapon view offsets per profile', () => {
    const pistol = buildWeaponViewFeel(createCombatFeelRuntimeState(), 'PISTOL', 0, false, 0, 0.8);
    const shotgun = buildWeaponViewFeel(createCombatFeelRuntimeState(), 'SHOTGUN', 0, false, 0, 0.8);
    expect(shotgun.offsetY).toBeGreaterThan(pistol.offsetY);
    expect(getWeaponFeelProfile('LAUNCHER').cameraKickRad).toBeGreaterThan(getWeaponFeelProfile('PISTOL').cameraKickRad);
  });

  it('exposes hit marker and death feedback timing', () => {
    const kill = getHitMarkerFeedbackTiming(true, false, false);
    const crit = getHitMarkerFeedbackTiming(false, true, false);
    expect(kill.durationMs).toBeGreaterThan(crit.durationMs);
    expect(getDeathFeedbackProfile(false).freezeMs).toBe(RAYCAST_KILL_FREEZE_MS);
    expect(getDeathFeedbackProfile(true).freezeMs).toBe(RAYCAST_BOSS_KILL_FREEZE_MS);
  });

  it('gates gameplay during freeze frames', () => {
    expect(shouldSkipGameplayDuringFreeze(100, 140)).toBe(true);
    expect(shouldSkipGameplayDuringFreeze(200, 140)).toBe(false);
  });

  it('fades corpses after the death burst window', () => {
    const enemy = mockEnemy({ deathBurstUntil: 1000 });
    expect(getCorpseFadeAlpha(enemy, 900)).toBe(1);
    expect(getCorpseFadeAlpha(enemy, 1100)).toBeLessThan(1);
    expect(getCorpseFadeAlpha(enemy, 2000)).toBe(0);
  });
});
