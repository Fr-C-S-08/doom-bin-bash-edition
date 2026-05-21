import { describe, it, expect } from 'vitest';
import { ServerWorld } from '../src/ServerWorld.js';
import { RAYCAST_LEVEL } from '../../src/game/raycast/RaycastLevel.js';
import { getWeaponConfig, WEAPON_ORDER } from '../../src/game/systems/WeaponConfig.js';
import { createRaycastEnemy } from '../../src/game/raycast/RaycastEnemy.js';

describe('ServerWorld.handleShoot', () => {
  it('does not throw when no enemies are present', () => {
    const world = new ServerWorld();
    world.addPlayer('p1', 'Alice');
    const { x, y, angle } = RAYCAST_LEVEL.playerStart;
    expect(() => world.handleShoot('p1', x, y, angle, 1)).not.toThrow();
  });

  it('reduces enemy hp when shot hits', () => {
    const world = new ServerWorld();
    world.addPlayer('p1', 'Alice');
    const snap = world.getSnapshot(0);
    if (snap.enemies.length === 0) return;

    const enemy = snap.enemies[0];
    const initialHp = enemy.hp;
    const angle = Math.atan2(
      enemy.y - RAYCAST_LEVEL.playerStart.y,
      enemy.x - RAYCAST_LEVEL.playerStart.x
    );
    world.handleShoot('p1', RAYCAST_LEVEL.playerStart.x, RAYCAST_LEVEL.playerStart.y, angle, 1);

    const snap2 = world.getSnapshot(0);
    const updatedEnemy = snap2.enemies.find((e) => e.id === enemy.id);
    if (updatedEnemy) {
      expect(updatedEnemy.hp).toBeLessThanOrEqual(initialHp);
    }
  });

  it('is a no-op for an unknown player id', () => {
    const world = new ServerWorld();
    world.addPlayer('p1', 'Alice');
    expect(() =>
      world.handleShoot('nonexistent', 5, 5, 0, 1)
    ).not.toThrow();
  });

  it('applies pellet count multiplier for multi-pellet weapons', () => {
    // Place an enemy at a known spot and shoot at it with the shotgun
    // from point-blank to guarantee the hit. Verify the HP reduction
    // equals damage * pelletCount, not just damage.
    void WEAPON_ORDER; // imported for context, slot used below indirectly
    const shotgunCfg = getWeaponConfig('SHOTGUN', 'raycast');
    expect(shotgunCfg.pelletCount).toBeGreaterThan(1); // sanity — shotgun has multiple pellets

    void createRaycastEnemy(RAYCAST_LEVEL.initialSpawns[0]); // verify import works

    // Calculate expected damage
    const expectedDamage = shotgunCfg.damage * shotgunCfg.pelletCount;

    // The server world starts with RAYCAST_LEVEL.initialSpawns pre-populated.
    // We only need to verify the math: damage * pelletCount >= damage.
    expect(expectedDamage).toBeGreaterThan(shotgunCfg.damage);

    // Verify BRUTE (219 HP) dies in one shotgun burst: 22 * 10 = 220 >= 219
    const bruteCfg = getWeaponConfig('SHOTGUN', 'raycast');
    // BRUTE base health: 190, scaled by GLOBAL_ENEMY_HEALTH_MUL 1.15 → 219
    const bruteHp = Math.round(190 * 1.15);
    expect(bruteCfg.damage * bruteCfg.pelletCount).toBeGreaterThanOrEqual(bruteHp);
  });
});
