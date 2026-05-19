import { describe, expect, it } from 'vitest';
import type { RaycastEnemy } from '../game/raycast/RaycastEnemy';
import { getEnemyConfig } from '../game/entities/enemyConfig';
import { buildRaycastPatrolWaypoints } from '../game/raycast/RaycastPatrol';
import {
  accumulateTacticalStuck,
  blendTacticalSteer,
  computeSeparationSteer,
  decideRaycastEnemyBehavior,
  getIdealDistanceBand,
  getRaycastTacticProfile,
  isRaycastMemoryActive,
  pickStrafeSign,
  propagateRaycastGroupAlert,
  RAYCAST_MEMORY_SEARCH_MS,
  RAYCAST_TACTICAL_STUCK_MS,
  shouldApplyStrafe
} from '../game/raycast/RaycastEnemyTactics';

function mockEnemy(id: string, x: number, y: number, overrides: Partial<RaycastEnemy> = {}): RaycastEnemy {
  return {
    id,
    kind: 'GRUNT',
    x,
    y,
    health: 20,
    maxHealth: 20,
    alive: true,
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
    deathBurstUntil: 0,
    patrolWaypoints: buildRaycastPatrolWaypoints(x, y, id),
    patrolWaypointIndex: 0,
    alertUntilTime: 0,
    lastKnownPlayerX: x,
    lastKnownPlayerY: y,
    lastSeenPlayerAt: 0,
    strafeSign: 1,
    strafeFlipAt: 0,
    tacticalStuckMs: 0,
    wasCombatActiveLastTick: false,
    roamHeadingRad: 0,
    roamNextRedirectAt: 0,
    roamStuckMs: 0,
    ...overrides
  };
}

describe('raycast enemy tactics', () => {
  it('exposes role distance bands per kind', () => {
    const ranged = getRaycastTacticProfile('RANGED');
    expect(getIdealDistanceBand(250, ranged)).toBe('ideal');
    expect(getIdealDistanceBand(120, ranged)).toBe('too_close');
    const grunt = getRaycastTacticProfile('GRUNT');
    expect(getIdealDistanceBand(40, grunt)).toBe('ideal');
  });

  it('applies separation away from neighbors', () => {
    const a = mockEnemy('a', 2, 2);
    const b = mockEnemy('b', 2.15, 2);
    const sep = computeSeparationSteer(a, [a, b], getRaycastTacticProfile('GRUNT'));
    expect(Math.hypot(sep.x, sep.y)).toBeGreaterThan(0.05);
  });

  it('propagates group alert to nearby enemies', () => {
    const source = mockEnemy('src', 5, 5);
    const near = mockEnemy('near', 5.8, 5.2);
    const far = mockEnemy('far', 12, 12);
    const count = propagateRaycastGroupAlert([source, near, far], 5, 5, 1000, 2.5, 5000);
    expect(count).toBe(1);
    expect(near.alertUntilTime).toBe(5000);
    expect(far.alertUntilTime).toBe(0);
  });

  it('tracks memory timeout after last sighting', () => {
    const enemy = mockEnemy('mem', 1, 1, { lastSeenPlayerAt: 1000 });
    expect(isRaycastMemoryActive(enemy, 1000 + RAYCAST_MEMORY_SEARCH_MS - 1)).toBe(true);
    expect(isRaycastMemoryActive(enemy, 1000 + RAYCAST_MEMORY_SEARCH_MS + 1)).toBe(false);
  });

  it('enables strafe for pressure roles in chase', () => {
    expect(shouldApplyStrafe('CHASE', getRaycastTacticProfile('STALKER'))).toBe(true);
    expect(shouldApplyStrafe('RANGED_ATTACK', getRaycastTacticProfile('RANGED'))).toBe(false);
  });

  it('flips strafe sign on a timer', () => {
    const enemy = mockEnemy('s', 0, 0, { strafeFlipAt: 0, strafeSign: 1 });
    const first = pickStrafeSign(enemy, 500);
    expect(Math.abs(first)).toBe(1);
    enemy.strafeFlipAt = 0;
    const second = pickStrafeSign(enemy, 2000);
    expect(Math.abs(second)).toBe(1);
  });

  it('retreats ranged enemies when player is too close', () => {
    const config = getEnemyConfig('RANGED', 'raycast');
    const profile = getRaycastTacticProfile('RANGED');
    const decision = decideRaycastEnemyBehavior(1.2, true, true, config, profile);
    expect(decision.action).toBe('RETREAT');
  });

  it('accumulates tactical stuck time when movement is blocked', () => {
    expect(accumulateTacticalStuck(0, 600, 0)).toBeGreaterThan(RAYCAST_TACTICAL_STUCK_MS * 0.5);
    expect(accumulateTacticalStuck(0.05, 200, 400)).toBeLessThan(400);
  });

  it('blends strafe into movement direction', () => {
    const blended = blendTacticalSteer({ x: 1, y: 0 }, { x: 0, y: 0 }, getRaycastTacticProfile('STALKER'), 1, 0.5);
    expect(Math.abs(blended.y)).toBeGreaterThan(0.1);
  });
});
