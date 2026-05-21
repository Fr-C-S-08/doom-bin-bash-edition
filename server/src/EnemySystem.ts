import { updateRaycastEnemies, type RaycastEnemyUpdateResult } from '../../src/game/raycast/RaycastEnemySystem.js';
import type { RaycastMap } from '../../src/game/raycast/RaycastMap.js';
import type { RaycastEnemy } from '../../src/game/raycast/RaycastEnemy.js';
import type { PlayerState } from '../../shared/types.js';

/** Returns the alive player closest to the centroid of living enemies, or null. */
export function findTargetPlayer(
  enemies: RaycastEnemy[],
  players: PlayerState[]
): PlayerState | null {
  const alivePlayers = players.filter((p) => p.alive);
  if (alivePlayers.length === 0) return null;
  if (alivePlayers.length === 1) return alivePlayers[0];

  const livingEnemies = enemies.filter((e) => e.alive);
  if (livingEnemies.length === 0) return alivePlayers[0];

  // Compute centroid of living enemies
  const cx = livingEnemies.reduce((s, e) => s + e.x, 0) / livingEnemies.length;
  const cy = livingEnemies.reduce((s, e) => s + e.y, 0) / livingEnemies.length;

  let nearest = alivePlayers[0];
  let nearestDist = Infinity;
  for (const p of alivePlayers) {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const dist = dx * dx + dy * dy;
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = p;
    }
  }
  return nearest;
}

export function tickEnemies(
  map: RaycastMap,
  enemies: RaycastEnemy[],
  players: PlayerState[],
  time: number,
  deltaMs: number
): RaycastEnemyUpdateResult {
  const target = findTargetPlayer(enemies, players);
  const raycastTarget = target
    ? { x: target.x, y: target.y, alive: true }
    : { x: 0, y: 0, alive: false };
  return updateRaycastEnemies(map, enemies, raycastTarget, time, deltaMs, {});
}
