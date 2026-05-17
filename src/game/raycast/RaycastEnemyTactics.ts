import type { EnemyConfig } from '../entities/enemyConfig';
import { decideEnemyBehavior, getDirection, type EnemyBehaviorDecision } from '../systems/EnemyBehaviorSystem';
import type { MovementVector } from '../systems/MovementSystem';
import type { EnemyKind } from '../types/game';
import type { RaycastEnemy, RaycastPlayerTarget } from './RaycastEnemy';
import { pickOpenRoamHeadingToward } from './RaycastEnemyRoam';
import type { RaycastMap } from './RaycastMap';

const GRID_SCALE = 100;

export const RAYCAST_GROUP_ALERT_RADIUS_WORLD = 3.4;
export const RAYCAST_GUNFIRE_ALERT_RADIUS_WORLD = 5.2;
export const RAYCAST_TACTICAL_STUCK_MS = 520;
export const RAYCAST_STRAFE_FLIP_MIN_MS = 380;
export const RAYCAST_STRAFE_FLIP_VAR_MS = 420;
export const RAYCAST_MEMORY_SEARCH_MS = 4200;

export interface RaycastTacticProfile {
  kind: EnemyKind;
  idealMinGrid: number;
  idealMaxGrid: number;
  strafeWeight: number;
  separationRadius: number;
  separationWeight: number;
  orbitBias: number;
  rushWhenBeyondIdeal: number;
  retreatWhenBelowGrid: number;
}

export const RAYCAST_TACTIC_PROFILES: Record<EnemyKind, RaycastTacticProfile> = {
  GRUNT: {
    kind: 'GRUNT',
    idealMinGrid: 0,
    idealMaxGrid: 48,
    strafeWeight: 0.22,
    separationRadius: 0.42,
    separationWeight: 0.38,
    orbitBias: 0.12,
    rushWhenBeyondIdeal: 1.12,
    retreatWhenBelowGrid: 0
  },
  BRUTE: {
    kind: 'BRUTE',
    idealMinGrid: 22,
    idealMaxGrid: 62,
    strafeWeight: 0.14,
    separationRadius: 0.52,
    separationWeight: 0.48,
    orbitBias: 0.08,
    rushWhenBeyondIdeal: 0.92,
    retreatWhenBelowGrid: 0
  },
  STALKER: {
    kind: 'STALKER',
    idealMinGrid: 28,
    idealMaxGrid: 72,
    strafeWeight: 0.58,
    separationRadius: 0.38,
    separationWeight: 0.32,
    orbitBias: 0.42,
    rushWhenBeyondIdeal: 1.05,
    retreatWhenBelowGrid: 0
  },
  RANGED: {
    kind: 'RANGED',
    idealMinGrid: 195,
    idealMaxGrid: 285,
    strafeWeight: 0.4,
    separationRadius: 0.48,
    separationWeight: 0.35,
    orbitBias: 0.28,
    rushWhenBeyondIdeal: 0.78,
    retreatWhenBelowGrid: 165
  },
  SCRAMBLER: {
    kind: 'SCRAMBLER',
    idealMinGrid: 55,
    idealMaxGrid: 125,
    strafeWeight: 0.48,
    separationRadius: 0.4,
    separationWeight: 0.4,
    orbitBias: 0.35,
    rushWhenBeyondIdeal: 0.88,
    retreatWhenBelowGrid: 42
  },
  FLASHER: {
    kind: 'FLASHER',
    idealMinGrid: 32,
    idealMaxGrid: 88,
    strafeWeight: 0.52,
    separationRadius: 0.4,
    separationWeight: 0.34,
    orbitBias: 0.38,
    rushWhenBeyondIdeal: 1.08,
    retreatWhenBelowGrid: 0
  }
};

const SCRATCH_SEP = { x: 0, y: 0 };

export function getRaycastTacticProfile(kind: EnemyKind): RaycastTacticProfile {
  return RAYCAST_TACTIC_PROFILES[kind] ?? RAYCAST_TACTIC_PROFILES.GRUNT;
}

export function decideRaycastEnemyBehavior(
  distanceWorld: number,
  enemyAlive: boolean,
  targetAlive: boolean,
  config: EnemyConfig,
  profile: RaycastTacticProfile
): EnemyBehaviorDecision {
  const distanceGrid = distanceWorld * GRID_SCALE;
  const base = decideEnemyBehavior({
    distanceToTarget: distanceGrid,
    enemyAlive,
    targetAlive,
    config
  });

  if (!targetAlive || base.action === 'IDLE') return base;

  if (config.behaviorHint === 'RANGED_PRESSURE') {
    if (distanceGrid < profile.retreatWhenBelowGrid) {
      return { action: 'RETREAT', speedMultiplier: 0.95 };
    }
    if (distanceGrid >= profile.idealMinGrid && distanceGrid <= profile.idealMaxGrid) {
      if (distanceGrid <= config.attackRange) {
        return { action: 'RANGED_ATTACK', speedMultiplier: 0 };
      }
      return { action: 'CHASE', speedMultiplier: 0.42 };
    }
    if (distanceGrid > profile.idealMaxGrid) {
      return { action: 'CHASE', speedMultiplier: profile.rushWhenBeyondIdeal * 0.72 };
    }
  }

  if (base.action === 'CHASE' && distanceGrid < profile.idealMinGrid * 0.85 && profile.retreatWhenBelowGrid > 0) {
    return { action: 'RETREAT', speedMultiplier: 0.75 };
  }

  if (base.action === 'CHASE' && distanceGrid > profile.idealMaxGrid) {
    return { action: 'CHASE', speedMultiplier: base.speedMultiplier * profile.rushWhenBeyondIdeal };
  }

  const inOrbitBand =
    distanceGrid >= profile.idealMinGrid &&
    distanceGrid <= profile.idealMaxGrid &&
    distanceGrid > config.attackRange * 1.15;
  if (base.action === 'CHASE' && inOrbitBand) {
    return { action: 'CHASE', speedMultiplier: base.speedMultiplier * 0.62 };
  }

  return base;
}

export function shouldApplyStrafe(action: EnemyBehaviorDecision['action'], profile: RaycastTacticProfile): boolean {
  return profile.strafeWeight > 0.05 && (action === 'CHASE' || action === 'RETREAT');
}

export function pickStrafeSign(enemy: RaycastEnemy, time: number): number {
  if (time >= enemy.strafeFlipAt) {
    const salt = (enemy.id.charCodeAt(0) + Math.floor(time / 200)) % 2;
    enemy.strafeSign = salt === 0 ? -1 : 1;
    const jitter = (enemy.id.length * 37 + Math.floor(time)) % RAYCAST_STRAFE_FLIP_VAR_MS;
    enemy.strafeFlipAt = time + RAYCAST_STRAFE_FLIP_MIN_MS + jitter;
  }
  return enemy.strafeSign >= 0 ? 1 : -1;
}

export function computeSeparationSteer(
  enemy: RaycastEnemy,
  enemies: readonly RaycastEnemy[],
  profile: RaycastTacticProfile,
  out: MovementVector = SCRATCH_SEP
): MovementVector {
  let sx = 0;
  let sy = 0;
  const radius = profile.separationRadius;
  const minDist = radius * radius;

  for (let i = 0; i < enemies.length; i += 1) {
    const other = enemies[i];
    if (other === enemy || !other.alive) continue;
    const dx = enemy.x - other.x;
    const dy = enemy.y - other.y;
    const d2 = dx * dx + dy * dy;
    if (d2 >= minDist || d2 < 0.0001) continue;
    const inv = (radius - Math.sqrt(d2)) / radius;
    sx += (dx / Math.sqrt(d2)) * inv;
    sy += (dy / Math.sqrt(d2)) * inv;
  }

  out.x = sx;
  out.y = sy;
  return out;
}

export function blendTacticalSteer(
  primary: MovementVector,
  separation: MovementVector,
  profile: RaycastTacticProfile,
  strafeSign: number,
  strafeWeight: number
): MovementVector {
  let px = primary.x;
  let py = primary.y;
  const mag = Math.hypot(px, py);
  if (mag > 0.0001) {
    const inv = 1 / mag;
    const perpX = -py * inv * strafeSign;
    const perpY = px * inv * strafeSign;
    px += perpX * strafeWeight;
    py += perpY * strafeWeight;
  }

  px += separation.x * profile.separationWeight;
  py += separation.y * profile.separationWeight;

  const len = Math.hypot(px, py);
  if (len <= 0.0001) return { x: 0, y: 0 };
  return { x: px / len, y: py / len };
}

export interface TacticalMoveInput {
  enemy: RaycastEnemy;
  enemies: readonly RaycastEnemy[];
  player: RaycastPlayerTarget;
  map: RaycastMap;
  config: EnemyConfig;
  profile: RaycastTacticProfile;
  decision: EnemyBehaviorDecision;
  time: number;
  deltaMs: number;
}

export function computeTacticalMoveDirection(input: TacticalMoveInput): MovementVector {
  const { enemy, enemies, player, map, profile, decision, time } = input;
  let primary =
    decision.action === 'RETREAT' ? getDirection(player, enemy) : getDirection(enemy, player);

  if (enemy.tacticalStuckMs >= RAYCAST_TACTICAL_STUCK_MS) {
    const escape = pickOpenRoamHeadingToward(map, enemy.x, enemy.y, enemy.radius, player.x, player.y);
    primary = { x: Math.cos(escape), y: Math.sin(escape) };
    enemy.tacticalStuckMs = 0;
  }

  const strafeW = shouldApplyStrafe(decision.action, profile) ? profile.strafeWeight : 0;
  const sign = strafeW > 0 ? pickStrafeSign(enemy, time) : 1;
  const sep = computeSeparationSteer(enemy, enemies, profile);
  return blendTacticalSteer(primary, sep, profile, sign, strafeW);
}

export function accumulateTacticalStuck(movedWorld: number, deltaMs: number, previousMs: number): number {
  if (movedWorld >= 0.012) return Math.max(0, previousMs - deltaMs * 1.35);
  return previousMs + deltaMs;
}

export function markRaycastPlayerSeen(enemy: RaycastEnemy, player: RaycastPlayerTarget, time: number): void {
  enemy.lastKnownPlayerX = player.x;
  enemy.lastKnownPlayerY = player.y;
  enemy.lastSeenPlayerAt = time;
}

export function isRaycastMemoryActive(enemy: RaycastEnemy, time: number): boolean {
  if (enemy.lastSeenPlayerAt <= 0) return false;
  return time - enemy.lastSeenPlayerAt < RAYCAST_MEMORY_SEARCH_MS;
}

export function propagateRaycastGroupAlert(
  enemies: readonly RaycastEnemy[],
  originX: number,
  originY: number,
  time: number,
  radiusWorld: number,
  alertUntil: number
): number {
  const r2 = radiusWorld * radiusWorld;
  let count = 0;
  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i];
    if (!enemy.alive) continue;
    const dx = enemy.x - originX;
    const dy = enemy.y - originY;
    const d2 = dx * dx + dy * dy;
    if (d2 < 0.04 || d2 > r2) continue;
    if (enemy.alertUntilTime > time) continue;
    enemy.alertUntilTime = alertUntil;
    enemy.lastKnownPlayerX = originX;
    enemy.lastKnownPlayerY = originY;
    enemy.lastSeenPlayerAt = time;
    count += 1;
  }
  return count;
}

export function notifyRaycastEnemyDamaged(
  enemies: readonly RaycastEnemy[],
  damaged: RaycastEnemy,
  playerX: number,
  playerY: number,
  time: number
): void {
  damaged.lastKnownPlayerX = playerX;
  damaged.lastKnownPlayerY = playerY;
  damaged.lastSeenPlayerAt = time;
  damaged.alertUntilTime = Math.max(damaged.alertUntilTime, time + RAYCAST_MEMORY_SEARCH_MS);
  propagateRaycastGroupAlert(
    enemies,
    damaged.x,
    damaged.y,
    time,
    RAYCAST_GROUP_ALERT_RADIUS_WORLD,
    time + RAYCAST_MEMORY_SEARCH_MS
  );
}

export function notifyRaycastGunfire(
  enemies: readonly RaycastEnemy[],
  playerX: number,
  playerY: number,
  time: number
): void {
  propagateRaycastGroupAlert(
    enemies,
    playerX,
    playerY,
    time,
    RAYCAST_GUNFIRE_ALERT_RADIUS_WORLD,
    time + RAYCAST_MEMORY_SEARCH_MS * 0.72
  );
}

export function getIdealDistanceBand(
  distanceGrid: number,
  profile: RaycastTacticProfile
): 'too_close' | 'ideal' | 'too_far' {
  if (distanceGrid < profile.idealMinGrid) return 'too_close';
  if (distanceGrid > profile.idealMaxGrid) return 'too_far';
  return 'ideal';
}
