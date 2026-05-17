import { updateRaycastEnemies, type RaycastEnemyUpdateResult } from '../../src/game/raycast/RaycastEnemySystem.js';
import type { RaycastMap } from '../../src/game/raycast/RaycastMap.js';
import type { RaycastEnemy } from '../../src/game/raycast/RaycastEnemy.js';
import type { PlayerState } from '../../shared/types.js';

export function tickEnemies(
  map: RaycastMap,
  enemies: RaycastEnemy[],
  players: PlayerState[],
  time: number,
  deltaMs: number
): RaycastEnemyUpdateResult {
  const alivePlayer = players.find((p) => p.alive);
  const target = alivePlayer
    ? { x: alivePlayer.x, y: alivePlayer.y, alive: true }
    : { x: 0, y: 0, alive: false };
  return updateRaycastEnemies(map, enemies, target, time, deltaMs, {});
}
