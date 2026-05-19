import { describe, expect, it } from 'vitest';
import { createRaycastEnemy } from '../game/raycast/RaycastEnemy';
import {
  RAYCAST_ELITE_SPAWN_BASE_CHANCE,
  RAYCAST_ENEMY_IDENTITY,
  RAYCAST_ENEMY_READABILITY,
  RAYCAST_MAX_DISRUPTOR_RATIO,
  adjustDirectorSpawnKind,
  countAliveByKind,
  formatRaycastEnemyIdentityLabel,
  getCompositionRatios,
  getRaycastSpawnTelegraphMs,
  isDisruptorKind,
  rollRaycastEnemyVariant
} from '../game/raycast/RaycastEnemyIdentity';

describe('raycast enemy identity', () => {
  it('maps each kind to a distinct combat role color lane', () => {
    const colors = new Set(Object.values(RAYCAST_ENEMY_IDENTITY).map((profile) => profile.roleColor));
    expect(colors.has('red')).toBe(true);
    expect(colors.has('purple')).toBe(true);
    expect(colors.has('blue')).toBe(true);
    expect(colors.has('green')).toBe(true);
    expect(colors.has('yellow')).toBe(true);
    expect(RAYCAST_ENEMY_IDENTITY.FLASHER.roleTitle).toBe('DISRUPTOR');
    expect(RAYCAST_ENEMY_IDENTITY.BRUTE.roleTitle).toBe('TANK');
    expect(RAYCAST_ENEMY_IDENTITY.SCRAMBLER.roleTitle).toBe('SUPPORT');
  });

  it('exposes readability telegraph config per kind', () => {
    const gruntTell = getRaycastSpawnTelegraphMs({
      baseMs: 820,
      kind: 'GRUNT',
      visibleToPlayer: true,
      distanceToPlayer: 4
    });
    const flasherTell = getRaycastSpawnTelegraphMs({
      baseMs: 820,
      kind: 'FLASHER',
      visibleToPlayer: false,
      distanceToPlayer: 8
    });
    expect(gruntTell).toBeGreaterThan(flasherTell);
    expect(gruntTell).toBe(820 + RAYCAST_ENEMY_READABILITY.spawnTellVisibleBonusMs + RAYCAST_ENEMY_READABILITY.spawnTellCloseBonusMs);
  });

  it('rolls elite variants rarely with a display name', () => {
    let elites = 0;
    for (let i = 0; i < 400; i += 1) {
      const roll = rollRaycastEnemyVariant('GRUNT', () => i / 400, i, 0);
      if (roll.variant === 'ELITE') {
        elites += 1;
        expect(roll.eliteDisplayName).toBeTruthy();
      }
    }
    expect(elites).toBeGreaterThan(4);
    expect(elites).toBeLessThan(80);
    expect(RAYCAST_ELITE_SPAWN_BASE_CHANCE).toBeLessThan(0.08);
  });

  it('formats elite HUD labels with call-sign', () => {
    const enemy = createRaycastEnemy({ id: 'e', kind: 'GRUNT', x: 1, y: 1 });
    enemy.variant = 'ELITE';
    enemy.eliteDisplayName = 'REAVER';
    expect(formatRaycastEnemyIdentityLabel(enemy)).toContain('REAVER');
    expect(formatRaycastEnemyIdentityLabel(enemy)).toContain('★');
  });

  it('balances disruptor-heavy compositions', () => {
    const counts = countAliveByKind([
      createRaycastEnemy({ id: 'a', kind: 'FLASHER', x: 0, y: 0 }),
      createRaycastEnemy({ id: 'b', kind: 'SCRAMBLER', x: 0, y: 0 }),
      createRaycastEnemy({ id: 'c', kind: 'FLASHER', x: 0, y: 0 })
    ]);
    const ratios = getCompositionRatios(counts);
    expect(ratios.disruptorRatio).toBe(1);
    expect(isDisruptorKind('FLASHER')).toBe(true);
    const adjusted = adjustDirectorSpawnKind('FLASHER', counts, () => 0.1);
    expect(adjusted === 'GRUNT' || adjusted === 'STALKER').toBe(true);
    expect(RAYCAST_MAX_DISRUPTOR_RATIO).toBeLessThanOrEqual(0.35);
  });

  it('replaces artillery spam when ranged density is too high', () => {
    const counts = countAliveByKind([
      createRaycastEnemy({ id: 'r1', kind: 'RANGED', x: 0, y: 0 }),
      createRaycastEnemy({ id: 'r2', kind: 'RANGED', x: 0, y: 0 }),
      createRaycastEnemy({ id: 'g1', kind: 'GRUNT', x: 0, y: 0 })
    ]);
    const adjusted = adjustDirectorSpawnKind('RANGED', counts, () => 0.2);
    expect(adjusted === 'GRUNT' || adjusted === 'BRUTE').toBe(true);
  });
});
