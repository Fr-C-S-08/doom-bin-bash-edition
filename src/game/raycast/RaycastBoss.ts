import type { BalanceProfile } from '../types/BalanceProfile';
import type { WeaponKind } from '../systems/WeaponTypes';
import { createProjectileSpawns } from '../systems/WeaponSystem';
import { castRay, isWallAt, type RaycastMap } from './RaycastMap';
import type { RaycastEnemyProjectile } from './RaycastEnemySystem';
import type { RaycastPlayerState } from './RaycastPlayerController';
import { normalizeAngle } from './RaycastCombatSystem';
import {
  type BossVolleyKind,
  type RaycastBossPlayerContext,
  computeBossMovementIntent,
  isBossDesperation,
  isPlayerCornered,
  isPlayerKitingBoss,
  pickBossVolleyKind,
  predictPlayerAimPoint
} from './RaycastBossAI';

export type { BossVolleyKind, RaycastBossPlayerContext } from './RaycastBossAI';
export {
  BOSS_DESPERATION_HP_RATIO,
  BOSS_INTRO_DURATION_MS,
  BOSS_PHASE3_SPEED_MUL,
  getBossIntroCopy,
  getDesperationPhaseLabel,
  isBossDesperation,
  isPlayerKitingBoss,
  pickBossVolleyKind,
  resolveBossMoveSpeed,
  tickDualBossCoordination
} from './RaycastBossAI';

/** Original guardian — not derived from third-party games. */
export const RAYCAST_BOSS_DISPLAY_NAME = 'Volt Archon';
export const RAYCAST_BOSS_ID = 'volt-archon';

/** Volley + HUD tuning presets — extend via authored `bossConfig`, not ad-hoc forks. */
export type RaycastBossBehaviorId = 'volt-archon' | 'bloom-warden' | 'ash-judge';

const GRID_SCALE = 100;
const BOSS_PROJECTILE_SPEED_GRID = 300;
const BOSS_PROJECTILE_DAMAGE = 26;
const BOSS_HEALTH_SCALE = 6;
const BOSS_PROJECTILE_RADIUS = 0.1;
const BOSS_PROJECTILE_COLOR = 0xff8833;
/** Bloom Warden volleys — toxic yellow-green read vs Volt Archon ion orange (Phase 30). */
const BLOOM_WARDEN_PROJECTILE_COLOR = 0xa8dd58;
const ASH_JUDGE_PROJECTILE_COLOR = 0xff5522;
const PHASE_TWO_DAMAGE_MUL = 1.2;
const PHASE_THREE_DAMAGE_MUL = 1.4;

export interface RaycastBossConfig {
  id: string;
  displayName: string;
  x: number;
  y: number;
  maxHealth: number;
  hitRadius: number;
  /** Defaults to Volt Archon sweep / bracket kit. */
  behavior?: RaycastBossBehaviorId;
}

export type RaycastBossArenaTwist = 'none' | 'ion_veil' | 'lateral_lane' | 'retreat_cut';

export interface RaycastBossState {
  id: string;
  displayName: string;
  x: number;
  y: number;
  maxHealth: number;
  hitRadius: number;
  health: number;
  phase: 1 | 2 | 3;
  behavior: RaycastBossBehaviorId;
  telegraphUntil: number;
  nextVolleyReadyAt: number;
  pendingVolleyAt: number;
  hitFlashUntil: number;
  alive: boolean;
  /** Telegraphed arena read — atmosphere / director hints only (no silent grid edits). */
  arenaTwist: RaycastBossArenaTwist;
  arenaTwistUntil: number;
  lastVolleyKind: BossVolleyKind | 'none';
  pendingVolleyKind: BossVolleyKind | 'none';
  strafeSign: number;
  strafeFlipAt: number;
  cutAngleSign: number;
  desperationAnnounced: boolean;
}

function telegraphMs(state: Pick<RaycastBossState, 'phase' | 'behavior'>): number {
  if (state.behavior === 'ash-judge') {
    return state.phase === 1 ? 800 : state.phase === 2 ? 600 : 500;
  }
  if (state.behavior === 'bloom-warden') {
    return state.phase === 1 ? 740 : state.phase === 2 ? 560 : 460;
  }
  /* Volt Archon scales pressure by phase while preserving readable telegraphs. */
  if (state.phase === 1) return 860;
  if (state.phase === 2) return 620;
  return 500;
}

function cooldownMs(state: Pick<RaycastBossState, 'phase' | 'behavior' | 'health' | 'maxHealth'>): number {
  let ms: number;
  if (state.behavior === 'ash-judge') {
    ms = state.phase === 1 ? 1680 : state.phase === 2 ? 1320 : 1040;
  } else if (state.behavior === 'bloom-warden') {
    ms = state.phase === 1 ? 1620 : state.phase === 2 ? 1280 : 980;
  } else {
    ms = state.phase === 1 ? 1780 : state.phase === 2 ? 1360 : 1020;
  }
  if (isBossDesperation(state)) ms = Math.round(ms * 0.88);
  return ms;
}

export function getRaycastBossPhaseLabel(
  boss: Pick<RaycastBossState, 'phase' | 'behavior' | 'health' | 'maxHealth'>
): string {
  if (isBossDesperation(boss)) {
    if (boss.behavior === 'ash-judge') return 'DESPERACIÓN // VEREDICTO FINAL';
    if (boss.behavior === 'bloom-warden') return 'DESPERACIÓN // ENJAMBRE COLAPSANTE';
    return 'DESPERACIÓN // SOBRECARGA TOTAL';
  }
  if (boss.behavior === 'ash-judge') {
    if (boss.phase === 1) return 'FASE 1: AGUJAS DE CENIZA';
    if (boss.phase === 2) return 'FASE 2: HALO MERIDIANO // CORTE DIVIDIDO';
    return 'FASE 3: MAELSTROM DEL VEREDICTO // CORTE ÍGNEO';
  }
  if (boss.behavior === 'bloom-warden') {
    if (boss.phase === 1) return 'FASE 1: VENAS GEMELAS';
    if (boss.phase === 2) return 'FASE 2: CRUZ FLORAL // PERPENDICULAR';
    return 'FASE 3: MAELSTROM DE ESPINAS // ENJAMBRE EN MALLA';
  }
  if (boss.phase === 1) return 'FASE 1: BARRIDO DE OBJETIVO';
  if (boss.phase === 2) return 'FASE 2: SOBRECARGA DEL NÚCLEO // CERCO IÓNICO';
  return 'FASE 3: TORMENTA DE ARCO // COLAPSO DE HALO';
}

export function createRaycastBossState(config: RaycastBossConfig, time: number): RaycastBossState {
  const scaledMaxHealth = Math.max(1, Math.round(config.maxHealth * BOSS_HEALTH_SCALE));
  return {
    id: config.id,
    displayName: config.displayName,
    x: config.x,
    y: config.y,
    maxHealth: scaledMaxHealth,
    hitRadius: config.hitRadius,
    health: scaledMaxHealth,
    phase: 1,
    behavior: config.behavior ?? 'volt-archon',
    telegraphUntil: 0,
    nextVolleyReadyAt: time + 1200,
    pendingVolleyAt: 0,
    hitFlashUntil: 0,
    alive: true,
    arenaTwist: 'none',
    arenaTwistUntil: 0,
    lastVolleyKind: 'none',
    pendingVolleyKind: 'none',
    strafeSign: config.id.charCodeAt(0) % 2 === 0 ? -1 : 1,
    strafeFlipAt: 0,
    cutAngleSign: config.id.charCodeAt(config.id.length - 1) % 2 === 0 ? -1 : 1,
    desperationAnnounced: false
  };
}

function applyBossPhaseArenaTwist(state: RaycastBossState, time: number): void {
  if (state.behavior === 'bloom-warden') {
    state.arenaTwist = 'lateral_lane';
  } else if (state.behavior === 'ash-judge') {
    state.arenaTwist = 'retreat_cut';
  } else {
    state.arenaTwist = 'ion_veil';
  }
  state.arenaTwistUntil = time + 5400;
}

export function tickRaycastBossArenaTwist(state: RaycastBossState, time: number): void {
  if (state.arenaTwist !== 'none' && state.arenaTwistUntil > 0 && time >= state.arenaTwistUntil) {
    state.arenaTwist = 'none';
    state.arenaTwistUntil = 0;
  }
}

export function syncRaycastBossPhase(state: RaycastBossState): void {
  const r = state.maxHealth <= 0 ? 0 : state.health / state.maxHealth;
  state.phase = r > 2 / 3 ? 1 : r > 1 / 3 ? 2 : 3;
}

export interface RaycastBossDamageKnockback {
  fromX: number;
  fromY: number;
  map: RaycastMap;
}

export function damageRaycastBoss(
  state: RaycastBossState,
  amount: number,
  time: number,
  knockback?: RaycastBossDamageKnockback
): boolean {
  if (!state.alive || amount <= 0) return false;
  const phaseBefore = state.phase;
  const chunkThreshold = Math.max(1, Math.ceil(state.maxHealth * 0.14));
  const heavyHit = state.health > amount && amount >= chunkThreshold;
  state.health = Math.max(0, state.health - amount);
  const impactHeavy = state.health > 0 && heavyHit;
  state.hitFlashUntil = time + 230 + (impactHeavy ? 118 : 0);
  syncRaycastBossPhase(state);
  if (knockback && state.health > 0) {
    const resist = 0.27;
    const pushMul = impactHeavy ? 1.48 : 1;
    const push = Math.min(0.048, 0.008 + amount * 0.00032) * resist * pushMul;
    const dx = state.x - knockback.fromX;
    const dy = state.y - knockback.fromY;
    const len = Math.hypot(dx, dy) || 1;
    const nx = state.x + (dx / len) * push;
    const ny = state.y + (dy / len) * push;
    if (canOccupyBossSpace(knockback.map, nx, state.y, state.hitRadius + 0.1)) state.x = nx;
    else if (canOccupyBossSpace(knockback.map, state.x + Math.sign(dx) * push * 0.62, state.y, state.hitRadius + 0.1)) {
      state.x += Math.sign(dx) * push * 0.62;
    }
    if (canOccupyBossSpace(knockback.map, state.x, ny, state.hitRadius + 0.1)) state.y = ny;
    else if (canOccupyBossSpace(knockback.map, state.x, state.y + Math.sign(dy) * push * 0.62, state.hitRadius + 0.1)) {
      state.y += Math.sign(dy) * push * 0.62;
    }
  }
  if (state.health <= 0) {
    state.alive = false;
    state.telegraphUntil = 0;
    state.pendingVolleyAt = 0;
    state.arenaTwist = 'none';
    state.arenaTwistUntil = 0;
    return true;
  }
  if (phaseBefore === 1 && state.phase === 2) {
    applyBossPhaseArenaTwist(state, time);
  }
  return false;
}

function rayIntersectsBossDisk(
  px: number,
  py: number,
  ux: number,
  uy: number,
  wallDist: number,
  bx: number,
  by: number,
  br: number
): boolean {
  const ocX = px - bx;
  const ocY = py - by;
  const bLin = 2 * (ocX * ux + ocY * uy);
  const c = ocX * ocX + ocY * ocY - br * br;
  const disc = bLin * bLin - 4 * c;
  if (disc < 0) return false;
  const s = Math.sqrt(disc);
  const t0 = (-bLin - s) / 2;
  const t1 = (-bLin + s) / 2;
  const tMin = Math.min(t0, t1);
  const tMax = Math.max(t0, t1);
  const tHit = tMin >= 0 ? tMin : tMax >= 0 ? tMax : -1;
  return tHit >= 0 && tHit <= wallDist + 0.03;
}

export function computeRaycastBossWeaponDamage(
  state: RaycastBossState,
  player: RaycastPlayerState,
  map: RaycastMap,
  weaponKind: WeaponKind,
  profile: BalanceProfile
): number {
  if (!state.alive) return 0;
  const projectiles = createProjectileSpawns(
    {
      ownerTeam: 'P1',
      origin: { x: player.x, y: player.y },
      direction: { x: Math.cos(player.angle), y: Math.sin(player.angle) },
      weaponKind
    },
    profile
  );

  let total = 0;
  for (const p of projectiles) {
    const ang = Math.atan2(p.vy, p.vx);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const wallDist = castRay(map, player.x, player.y, ang, player.angle).distance;
    if (rayIntersectsBossDisk(player.x, player.y, ux, uy, wallDist, state.x, state.y, state.hitRadius)) {
      total += p.damage;
    }
  }
  return total;
}

/** Pellets whose rays intersect the boss hit disk — scoring / accuracy instrumentation (Phase 24). */
export function countRaycastBossConnectingPellets(
  state: RaycastBossState,
  player: RaycastPlayerState,
  map: RaycastMap,
  weaponKind: WeaponKind,
  profile: BalanceProfile
): number {
  if (!state.alive) return 0;
  const projectiles = createProjectileSpawns(
    {
      ownerTeam: 'P1',
      origin: { x: player.x, y: player.y },
      direction: { x: Math.cos(player.angle), y: Math.sin(player.angle) },
      weaponKind
    },
    profile
  );
  let n = 0;
  for (const p of projectiles) {
    const ang = Math.atan2(p.vy, p.vx);
    const ux = Math.cos(ang);
    const uy = Math.sin(ang);
    const wallDist = castRay(map, player.x, player.y, ang, player.angle).distance;
    if (rayIntersectsBossDisk(player.x, player.y, ux, uy, wallDist, state.x, state.y, state.hitRadius)) {
      n += 1;
    }
  }
  return n;
}

export function getRaycastBossCrosshairTarget(
  player: Pick<RaycastPlayerState, 'x' | 'y' | 'angle'>,
  wallDistance: number,
  boss: RaycastBossState | null,
  time: number
): import('./RaycastCombatSystem').RaycastCrosshairTargetInfo | null {
  if (!boss?.alive) return null;
  const dx = boss.x - player.x;
  const dy = boss.y - player.y;
  const dist = Math.hypot(dx, dy);
  const angleTo = Math.atan2(dy, dx);
  const delta = Math.abs(normalizeAngle(angleTo - player.angle));
  const tol = Math.max(0.11, boss.hitRadius / Math.max(dist, 0.001));
  if (dist >= wallDistance || delta > tol) return null;
  return {
    id: boss.id,
    kindLabel: boss.displayName.toUpperCase(),
    health: boss.health,
    maxHealth: boss.maxHealth,
    healthRatio: boss.maxHealth <= 0 ? 0 : boss.health / boss.maxHealth,
    isWindingUp: time < boss.telegraphUntil,
    isTelegraphing: time < boss.telegraphUntil
  };
}

function spawnBossProjectile(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  time: number,
  color: number = BOSS_PROJECTILE_COLOR,
  damage: number = BOSS_PROJECTILE_DAMAGE
): RaycastEnemyProjectile {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const len = Math.hypot(dx, dy) || 1;
  const speed = BOSS_PROJECTILE_SPEED_GRID / GRID_SCALE;
  return {
    x: fromX + (dx / len) * 0.35,
    y: fromY + (dy / len) * 0.35,
    vx: (dx / len) * speed,
    vy: (dy / len) * speed,
    damage,
    radius: BOSS_PROJECTILE_RADIUS,
    alive: true,
    color,
    createdAt: time
  };
}

function canOccupyBossSpace(map: RaycastMap, x: number, y: number, radius: number): boolean {
  if (isWallAt(map, x, y)) return false;
  const checks = [
    [radius, 0],
    [-radius, 0],
    [0, radius],
    [0, -radius],
    [radius * 0.72, radius * 0.72],
    [radius * 0.72, -radius * 0.72],
    [-radius * 0.72, radius * 0.72],
    [-radius * 0.72, -radius * 0.72]
  ] as const;
  return checks.every(([ox, oy]) => !isWallAt(map, x + ox, y + oy));
}

export function tickRaycastBossMovement(
  state: RaycastBossState,
  map: RaycastMap,
  player: RaycastBossPlayerContext,
  deltaMs: number,
  time: number
): void {
  if (!state.alive || !player.alive || deltaMs <= 0) return;
  const telegraphSlow = time < state.telegraphUntil ? 0.45 : 1;
  const intent = computeBossMovementIntent(state, map, player, time, telegraphSlow);
  if (intent.speed <= 0) return;
  const step = (deltaMs / 1000) * intent.speed;
  const nx = state.x + intent.moveX * step;
  const ny = state.y + intent.moveY * step;

  if (canOccupyBossSpace(map, nx, ny, state.hitRadius + 0.1)) {
    state.x = nx;
    state.y = ny;
    return;
  }
  const slideX = state.x + Math.sign(intent.moveX) * step;
  if (canOccupyBossSpace(map, slideX, state.y, state.hitRadius + 0.1)) {
    state.x = slideX;
    return;
  }
  const slideY = state.y + Math.sign(intent.moveY) * step;
  if (canOccupyBossSpace(map, state.x, slideY, state.hitRadius + 0.1)) {
    state.y = slideY;
  }
}

function fanAngles(base: number, count: number, spread: number): number[] {
  if (count <= 1) return [base];
  const out: number[] = [];
  const step = spread / (count - 1);
  const start = base - spread * 0.5;
  for (let i = 0; i < count; i += 1) out.push(start + step * i);
  return out;
}

function getBossPelletColor(state: Pick<RaycastBossState, 'behavior'>): number {
  if (state.behavior === 'bloom-warden') return BLOOM_WARDEN_PROJECTILE_COLOR;
  if (state.behavior === 'ash-judge') return ASH_JUDGE_PROJECTILE_COLOR;
  return BOSS_PROJECTILE_COLOR;
}

function getBossProjectileDamage(state: Pick<RaycastBossState, 'phase' | 'health' | 'maxHealth'>): number {
  const phaseDamageMul = state.phase === 3 ? PHASE_THREE_DAMAGE_MUL : state.phase === 2 ? PHASE_TWO_DAMAGE_MUL : 1;
  const desperationMul = isBossDesperation(state) ? 1.08 : 1;
  return Math.max(1, Math.round(BOSS_PROJECTILE_DAMAGE * phaseDamageMul * desperationMul));
}

function fireBossVolleyKind(
  state: RaycastBossState,
  kind: BossVolleyKind,
  base: number,
  playerStationary: boolean,
  time: number,
  pelletColor: number,
  projectileDamage: number
): RaycastEnemyProjectile[] {
  const volley: RaycastEnemyProjectile[] = [];
  const pushFan = (count: number, spread: number) => {
    for (const a of fanAngles(base, count, spread)) {
      volley.push(
        spawnBossProjectile(state.x, state.y, state.x + Math.cos(a) * 3, state.y + Math.sin(a) * 3, time, pelletColor, projectileDamage)
      );
    }
  };
  const pushPerp = () => {
    volley.push(
      spawnBossProjectile(
        state.x,
        state.y,
        state.x + Math.cos(base + Math.PI * 0.5) * 3,
        state.y + Math.sin(base + Math.PI * 0.5) * 3,
        time,
        pelletColor,
        projectileDamage
      )
    );
    volley.push(
      spawnBossProjectile(
        state.x,
        state.y,
        state.x + Math.cos(base - Math.PI * 0.5) * 3,
        state.y + Math.sin(base - Math.PI * 0.5) * 3,
        time,
        pelletColor,
        projectileDamage
      )
    );
  };

  switch (kind) {
    case 'twin_rails':
      pushFan(2, 0.34);
      break;
    case 'fan':
      pushFan(playerStationary ? 3 : 1, 0.22);
      break;
    case 'fan_wide':
      pushFan(playerStationary ? 8 : 6, playerStationary ? 0.84 : 0.68);
      break;
    case 'bracket': {
      pushFan(playerStationary ? 5 : 3, playerStationary ? 0.54 : 0.36);
      const bracket = 0.52;
      volley.push(
        spawnBossProjectile(state.x, state.y, state.x + Math.cos(base - bracket) * 3, state.y + Math.sin(base - bracket) * 3, time, pelletColor, projectileDamage)
      );
      volley.push(
        spawnBossProjectile(state.x, state.y, state.x + Math.cos(base + bracket) * 3, state.y + Math.sin(base + bracket) * 3, time, pelletColor, projectileDamage)
      );
      break;
    }
    case 'cross':
      pushFan(playerStationary ? 6 : 4, playerStationary ? 0.58 : 0.42);
      pushPerp();
      break;
    case 'mesh':
      pushFan(playerStationary ? 7 : 5, playerStationary ? 0.82 : 0.62);
      for (let i = 0; i < 4; i += 1) {
        const a = (i * Math.PI) / 2 + time * 0.00085;
        volley.push(spawnBossProjectile(state.x, state.y, state.x + Math.cos(a) * 3, state.y + Math.sin(a) * 3, time, pelletColor, projectileDamage));
      }
      break;
    case 'spin': {
      const spin = time * 0.00105;
      const count = state.behavior === 'ash-judge' ? 3 : 4;
      for (let i = 0; i < count; i += 1) {
        const a = spin + (i * Math.PI * 2) / count;
        volley.push(spawnBossProjectile(state.x, state.y, state.x + Math.cos(a) * 3, state.y + Math.sin(a) * 3, time, pelletColor, projectileDamage));
      }
      break;
    }
    case 'spin_quad': {
      const spin = time * 0.00122;
      for (let i = 0; i < 4; i += 1) {
        const a = spin + (i * Math.PI * 2) / 4;
        volley.push(spawnBossProjectile(state.x, state.y, state.x + Math.cos(a) * 3, state.y + Math.sin(a) * 3, time, pelletColor, projectileDamage));
      }
      break;
    }
    case 'cutoff':
      pushFan(3, 0.28);
      for (const a of fanAngles(base + Math.PI * 0.5, 2, 0.38)) {
        volley.push(spawnBossProjectile(state.x, state.y, state.x + Math.cos(a) * 3, state.y + Math.sin(a) * 3, time, pelletColor, projectileDamage));
      }
      break;
    case 'zone_deny':
      for (let i = 0; i < 4; i += 1) {
        const a = (i * Math.PI) / 2 + base * 0.18;
        volley.push(spawnBossProjectile(state.x, state.y, state.x + Math.cos(a) * 3, state.y + Math.sin(a) * 3, time, pelletColor, projectileDamage));
      }
      pushFan(2, 0.24);
      break;
    case 'verdict_rush':
      pushFan(playerStationary ? 5 : 4, 0.48);
      for (const a of fanAngles(base + Math.PI, 2, 0.32)) {
        volley.push(spawnBossProjectile(state.x, state.y, state.x + Math.cos(a) * 3, state.y + Math.sin(a) * 3, time, pelletColor, projectileDamage));
      }
      break;
    default:
      pushFan(playerStationary ? 7 : 5, playerStationary ? 0.92 : 0.68);
      for (const a of fanAngles(base + Math.PI * 0.5, 3, 0.54)) {
        volley.push(spawnBossProjectile(state.x, state.y, state.x + Math.cos(a) * 3, state.y + Math.sin(a) * 3, time, pelletColor, projectileDamage));
      }
      break;
  }
  return volley;
}

export function tickRaycastBossVolleys(
  state: RaycastBossState,
  player: RaycastBossPlayerContext,
  time: number,
  map: RaycastMap
): RaycastEnemyProjectile[] {
  if (!state.alive || !player.alive) return [];

  if (state.pendingVolleyAt > 0) {
    if (time < state.pendingVolleyAt) return [];
    state.pendingVolleyAt = 0;
    state.telegraphUntil = 0;

    const aim = predictPlayerAimPoint(state, player, state.phase === 3 ? 0.2 : 0.14);
    const base = Math.atan2(aim.y - state.y, aim.x - state.x);
    const playerStationary = (player.stationaryMs ?? 0) >= 1000;
    const pelletColor = getBossPelletColor(state);
    const projectileDamage = getBossProjectileDamage(state);
    const kind = state.pendingVolleyKind === 'none' ? 'fan' : state.pendingVolleyKind;
    state.lastVolleyKind = kind;
    state.pendingVolleyKind = 'none';
    return fireBossVolleyKind(state, kind, base, playerStationary, time, pelletColor, projectileDamage);
  }

  if (time >= state.nextVolleyReadyAt) {
    const distance = Math.hypot(player.x - state.x, player.y - state.y);
    const pickCtx = {
      distance,
      playerStationary: (player.stationaryMs ?? 0) >= 1000,
      playerKiting: isPlayerKitingBoss(state, player),
      playerCornered: isPlayerCornered(map, player),
      desperation: isBossDesperation(state),
      timeSinceLastVolleyMs: Math.max(0, time - (state.nextVolleyReadyAt - cooldownMs(state)))
    };
    state.pendingVolleyKind = pickBossVolleyKind(state, pickCtx);
    state.telegraphUntil = time + telegraphMs(state);
    state.pendingVolleyAt = state.telegraphUntil;
    state.nextVolleyReadyAt = state.pendingVolleyAt + cooldownMs(state);
  }

  return [];
}
