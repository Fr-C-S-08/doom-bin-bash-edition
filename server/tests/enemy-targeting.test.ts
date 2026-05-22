import { describe, it, expect } from 'vitest';
import { findTargetPlayer } from '../src/EnemySystem.js';
import { createRaycastEnemy } from '../../src/game/raycast/RaycastEnemy.js';
import { RAYCAST_LEVEL } from '../../src/game/raycast/RaycastLevel.js';
import type { PlayerState } from '../../shared/types.js';

function makePlayer(id: string, x: number, y: number, alive = true): PlayerState {
  return { id, name: id, x, y, yaw: 0, hp: alive ? 100 : 0, maxHp: 100, weapon: 1, alive };
}

describe('findTargetPlayer', () => {
  it('returns null when no players are alive', () => {
    const enemy = createRaycastEnemy(RAYCAST_LEVEL.initialSpawns[0]);
    const result = findTargetPlayer([enemy], [makePlayer('p1', 5, 5, false)]);
    expect(result).toBeNull();
  });

  it('returns the nearest alive player to the enemy centroid', () => {
    const spawn = RAYCAST_LEVEL.initialSpawns[0];
    const enemy = createRaycastEnemy({ ...spawn, x: 10, y: 10 });

    // p1 is far, p2 is near the enemy
    const p1 = makePlayer('p1', 1, 1);
    const p2 = makePlayer('p2', 10, 11);

    const result = findTargetPlayer([enemy], [p1, p2]);
    expect(result?.id).toBe('p2');
  });
});
