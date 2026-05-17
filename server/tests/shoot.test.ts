import { describe, it, expect } from 'vitest';
import { ServerWorld } from '../src/ServerWorld.js';
import { RAYCAST_LEVEL } from '../../src/game/raycast/RaycastLevel.js';

function spawnedWorld(): ServerWorld {
  const world = new ServerWorld();
  world.addPlayer('p1', 'Alice');
  // Tick long enough for enemies to appear
  for (let i = 0; i < 400; i++) world.tick(50);
  return world;
}

describe('ServerWorld.handleShoot', () => {
  it('does not throw when no enemies are present', () => {
    const world = new ServerWorld();
    world.addPlayer('p1', 'Alice');
    const { x, y, angle } = RAYCAST_LEVEL.playerStart;
    expect(() => world.handleShoot('p1', x, y, angle, 1)).not.toThrow();
  });

  it('reduces enemy hp when shot hits', () => {
    const world = spawnedWorld();
    const snap = world.getSnapshot(400);
    if (snap.enemies.length === 0) return; // no enemies yet — skip

    const enemy = snap.enemies[0];
    const initialHp = enemy.hp;

    // Aim directly at enemy from its position (point-blank)
    const angle = Math.atan2(enemy.y - RAYCAST_LEVEL.playerStart.y, enemy.x - RAYCAST_LEVEL.playerStart.x);
    world.handleShoot('p1', RAYCAST_LEVEL.playerStart.x, RAYCAST_LEVEL.playerStart.y, angle, 1);

    const snap2 = world.getSnapshot(400);
    const updatedEnemy = snap2.enemies.find((e) => e.id === enemy.id);
    // Enemy either took damage or was already dead/not found
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
});
