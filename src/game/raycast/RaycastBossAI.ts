import type { RaycastBossBehaviorId, RaycastBossState } from './RaycastBoss';
import { isWallAt, type RaycastMap } from './RaycastMap';

/** HP ratio where desperation tactics kick in (independent of phase band). */
export const BOSS_DESPERATION_HP_RATIO = 0.15;
export const BOSS_INTRO_DURATION_MS = 2800;
export const BOSS_PHASE3_SPEED_MUL = 0.7;
/** Third boss fight (`ash-judge-seal`) only — movement 35% slower; not damage/HP/spawn. */
export const THIRD_BOSS_FIGHT_LEVEL_ID = 'ash-judge-seal';
export const THIRD_BOSS_FIGHT_SPEED_MULTIPLIER = 0.65;
export const BOSS_KITING_AWAY_DOT = -0.28;
export const BOSS_CORNER_WALL_PROBE = 0.42;

export type BossVolleyKind =
  | 'fan'
  | 'fan_wide'
  | 'bracket'
  | 'cross'
  | 'spin'
  | 'spin_quad'
  | 'twin_rails'
  | 'mesh'
  | 'cutoff'
  | 'zone_deny'
  | 'verdict_rush';

export type BossMoveMode = 'orbit' | 'cut_angle' | 'push' | 'hold';

export interface RaycastBossPlayerContext {
  x: number;
  y: number;
  alive: boolean;
  stationaryMs?: number;
  vx?: number;
  vy?: number;
}

export interface BossMovementIntent {
  moveX: number;
  moveY: number;
  speed: number;
  mode: BossMoveMode;
}

export interface BossVolleyPickContext {
  distance: number;
  playerStationary: boolean;
  playerKiting: boolean;
  playerCornered: boolean;
  desperation: boolean;
  timeSinceLastVolleyMs: number;
}

const SCRATCH_DUAL = { x: 0, y: 0 };

export function isBossDesperation(state: Pick<RaycastBossState, 'health' | 'maxHealth'>): boolean {
  if (state.maxHealth <= 0) return false;
  return state.health / state.maxHealth <= BOSS_DESPERATION_HP_RATIO;
}

export function getBossIntroCopy(displayName: string, behavior: RaycastBossBehaviorId): { title: string; subtitle: string } {
  if (behavior === 'ash-judge') {
    return { title: displayName.toUpperCase(), subtitle: 'VEREDICTO DEL SELLO // DOBLE FILO' };
  }
  if (behavior === 'bloom-warden') {
    return { title: displayName.toUpperCase(), subtitle: 'GUARDIÁN DE ESPINAS // NÚCLEO TÓXICO' };
  }
  return { title: displayName.toUpperCase(), subtitle: 'ARQUÍTECTO IÓNICO // NÚCLEO VIVO' };
}

export function isPlayerKitingBoss(
  boss: Pick<RaycastBossState, 'x' | 'y'>,
  player: RaycastBossPlayerContext
): boolean {
  const vx = player.vx ?? 0;
  const vy = player.vy ?? 0;
  const speed = Math.hypot(vx, vy);
  if (speed < 0.55) return false;
  const toBossX = boss.x - player.x;
  const toBossY = boss.y - player.y;
  const len = Math.hypot(toBossX, toBossY) || 1;
  const awayDot = (vx / speed) * (-toBossX / len) + (vy / speed) * (-toBossY / len);
  return awayDot >= Math.abs(BOSS_KITING_AWAY_DOT);
}

export function isPlayerCornered(map: RaycastMap, player: RaycastBossPlayerContext): boolean {
  const probes = [
    [BOSS_CORNER_WALL_PROBE, 0],
    [-BOSS_CORNER_WALL_PROBE, 0],
    [0, BOSS_CORNER_WALL_PROBE],
    [0, -BOSS_CORNER_WALL_PROBE]
  ] as const;
  let blocked = 0;
  for (const [ox, oy] of probes) {
    if (isWallAt(map, player.x + ox, player.y + oy)) blocked += 1;
  }
  return blocked >= 3;
}

export function predictPlayerAimPoint(
  boss: Pick<RaycastBossState, 'x' | 'y'>,
  player: RaycastBossPlayerContext,
  leadSeconds: number
): { x: number; y: number } {
  const dist = Math.hypot(player.x - boss.x, player.y - boss.y);
  const lead = Math.min(leadSeconds, 0.22 + dist * 0.028);
  return {
    x: player.x + (player.vx ?? 0) * lead,
    y: player.y + (player.vy ?? 0) * lead
  };
}

export function getBossPreferredRange(state: Pick<RaycastBossState, 'behavior' | 'phase'>): number {
  if (state.behavior === 'ash-judge') {
    return state.phase === 1 ? 4.0 : state.phase === 2 ? 3.42 : 3.1;
  }
  if (state.behavior === 'bloom-warden') {
    return state.phase === 1 ? 4.15 : state.phase === 2 ? 3.38 : 2.95;
  }
  return state.phase === 1 ? 3.9 : state.phase === 2 ? 3.3 : 2.85;
}

export function getBossBaseMoveSpeed(state: Pick<RaycastBossState, 'behavior' | 'phase'>): number {
  if (state.behavior === 'ash-judge') {
    return state.phase === 3 ? 1.72 : state.phase === 2 ? 1.48 : 1.2;
  }
  if (state.behavior === 'bloom-warden') {
    return state.phase === 3 ? 1.88 : state.phase === 2 ? 1.58 : 1.22;
  }
  return state.phase === 3 ? 1.82 : state.phase === 2 ? 1.56 : 1.18;
}

export function getBossStrafeWeight(state: Pick<RaycastBossState, 'behavior' | 'phase'>): number {
  if (state.behavior === 'ash-judge') {
    return state.phase === 3 ? 1.18 : state.phase === 2 ? 0.96 : 0.72;
  }
  if (state.behavior === 'bloom-warden') {
    return state.phase === 3 ? 1.2 : state.phase === 2 ? 0.92 : 0.68;
  }
  return state.phase === 3 ? 1.12 : state.phase === 2 ? 0.84 : 0.62;
}

export function resolveBossMoveSpeed(
  state: Pick<RaycastBossState, 'behavior' | 'phase' | 'health' | 'maxHealth' | 'arenaLevelId'>,
  telegraphSlow: number
): number {
  let speed = getBossBaseMoveSpeed(state);
  if (state.phase === 3) speed *= BOSS_PHASE3_SPEED_MUL;
  if (isBossDesperation(state)) speed *= 1.06;
  if (state.arenaLevelId === THIRD_BOSS_FIGHT_LEVEL_ID) {
    speed *= THIRD_BOSS_FIGHT_SPEED_MULTIPLIER;
  }
  return speed * telegraphSlow;
}

function volleyCandidates(
  behavior: RaycastBossBehaviorId,
  phase: 1 | 2 | 3,
  ctx: BossVolleyPickContext
): BossVolleyKind[] {
  const camp = ctx.playerStationary;
  const kite = ctx.playerKiting;
  const corner = ctx.playerCornered;
  const des = ctx.desperation;

  if (behavior === 'ash-judge') {
    if (des) return kite ? ['verdict_rush', 'cutoff', 'fan_wide'] : ['verdict_rush', 'spin_quad', 'zone_deny'];
    if (phase === 1) return kite ? ['cutoff', 'spin'] : ['spin'];
    if (phase === 2) return corner ? ['zone_deny', 'cross'] : camp ? ['fan_wide', 'cross'] : kite ? ['cutoff', 'cross'] : ['cross', 'fan'];
    return camp ? ['fan_wide', 'spin_quad'] : kite ? ['cutoff', 'verdict_rush'] : ['fan_wide', 'spin_quad'];
  }

  if (behavior === 'bloom-warden') {
    if (des) return kite ? ['zone_deny', 'mesh'] : ['mesh', 'fan_wide', 'zone_deny'];
    if (phase === 1) return ['twin_rails'];
    if (phase === 2) return corner ? ['zone_deny', 'cross'] : camp ? ['fan_wide', 'cross'] : kite ? ['cutoff', 'cross'] : ['cross', 'fan'];
    return camp ? ['mesh', 'fan_wide'] : kite ? ['cutoff', 'mesh'] : ['mesh', 'spin_quad'];
  }

  if (des) return kite ? ['cutoff', 'fan_wide'] : ['fan_wide', 'zone_deny', 'cross'];
  if (phase === 1) return camp ? ['fan', 'fan_wide'] : ['fan'];
  if (phase === 2) return corner ? ['zone_deny', 'bracket'] : camp ? ['fan_wide', 'bracket'] : kite ? ['cutoff', 'bracket'] : ['bracket', 'fan'];
  return camp ? ['fan_wide', 'cross'] : kite ? ['cutoff', 'cross'] : ['cross', 'fan_wide'];
}

export function pickBossVolleyKind(
  state: RaycastBossState,
  ctx: BossVolleyPickContext
): BossVolleyKind {
  const pool = volleyCandidates(state.behavior, state.phase, ctx);
  const alt = pool.filter((k) => k !== state.lastVolleyKind);
  const pickFrom = alt.length > 0 ? alt : pool;
  const distBias = ctx.distance > getBossPreferredRange(state) * 1.2 ? 0 : 1;
  const idx =
    (Math.floor((ctx.timeSinceLastVolleyMs + state.phase * 311 + pickFrom.length * 17) / 420) + distBias) %
    pickFrom.length;
  return pickFrom[idx] ?? pickFrom[0];
}

export function pickBossStrafeSign(state: RaycastBossState, time: number): number {
  if (time >= state.strafeFlipAt) {
    const salt = (state.id.charCodeAt(0) + Math.floor(time / 480)) % 2;
    state.strafeSign = salt === 0 ? -1 : 1;
    const jitter = (state.id.length * 41 + Math.floor(time)) % 520;
    state.strafeFlipAt = time + 420 + jitter;
  }
  return state.strafeSign >= 0 ? 1 : -1;
}

export function computeBossMovementIntent(
  state: RaycastBossState,
  map: RaycastMap,
  player: RaycastBossPlayerContext,
  time: number,
  telegraphSlow: number
): BossMovementIntent {
  const toPlayerX = player.x - state.x;
  const toPlayerY = player.y - state.y;
  const distance = Math.hypot(toPlayerX, toPlayerY);
  if (distance <= 0.001) {
    return { moveX: 0, moveY: 0, speed: 0, mode: 'hold' };
  }

  const ux = toPlayerX / distance;
  const uy = toPlayerY / distance;
  const strafeSign = pickBossStrafeSign(state, time);
  const strafeX = -uy * strafeSign;
  const strafeY = ux * strafeSign;

  const preferredRange = getBossPreferredRange(state);
  const kiting = isPlayerKitingBoss(state, player);
  const cornered = isPlayerCornered(map, player);
  const desperation = isBossDesperation(state);

  let mode: BossMoveMode = 'orbit';
  let chaseWeight = distance > preferredRange ? 1 : 0.32;
  let strafeWeight = getBossStrafeWeight(state);

  if (kiting) {
    mode = 'cut_angle';
    chaseWeight = 0.58;
    strafeWeight *= 1.22;
    const cutSign = state.cutAngleSign >= 0 ? 1 : -1;
    const cutX = -uy * cutSign;
    const cutY = ux * cutSign;
    const moveX = ux * chaseWeight + cutX * strafeWeight * 0.85 + strafeX * strafeWeight * 0.35;
    const moveY = uy * chaseWeight + cutY * strafeWeight * 0.85 + strafeY * strafeWeight * 0.35;
    const len = Math.hypot(moveX, moveY) || 1;
    return {
      moveX: moveX / len,
      moveY: moveY / len,
      speed: resolveBossMoveSpeed(state, telegraphSlow) * (desperation ? 1.05 : 1),
      mode
    };
  }

  if (distance > preferredRange * 1.28 || desperation) {
    mode = 'push';
    chaseWeight = Math.min(1.15, chaseWeight + 0.42);
    strafeWeight *= 0.72;
  } else if (cornered && distance < preferredRange * 1.05) {
    mode = 'hold';
    chaseWeight = 0.18;
    strafeWeight *= 1.08;
  }

  const moveX = ux * chaseWeight + strafeX * strafeWeight;
  const moveY = uy * chaseWeight + strafeY * strafeWeight;
  const len = Math.hypot(moveX, moveY) || 1;
  return {
    moveX: moveX / len,
    moveY: moveY / len,
    speed: resolveBossMoveSpeed(state, telegraphSlow),
    mode
  };
}

export function tickDualBossCoordination(
  bosses: readonly RaycastBossState[],
  player: Pick<RaycastBossPlayerContext, 'x' | 'y'>,
  time: number
): void {
  if (bosses.length < 2) return;
  const a = bosses[0];
  const b = bosses[1];
  if (!a.alive || !b.alive) return;

  const distA = Math.hypot(a.x - player.x, a.y - player.y);
  const distB = Math.hypot(b.x - player.x, b.y - player.y);
  const presser = distA <= distB ? a : b;
  const cutter = presser === a ? b : a;

  const midX = (a.x + b.x) * 0.5;
  const midY = (a.y + b.y) * 0.5;
  const toPlayerX = player.x - midX;
  const toPlayerY = player.y - midY;
  const len = Math.hypot(toPlayerX, toPlayerY) || 1;
  const nx = toPlayerX / len;
  const ny = toPlayerY / len;
  const flankX = -ny;
  const flankY = nx;

  const pressRing = presser.phase === 3 ? 0.92 : 1.08;
  const cutRing = cutter.phase === 3 ? 1.38 : 1.22;
  const escapeBias = Math.sin(time / 680) >= 0 ? 1 : -1;

  const targetPressX = player.x - nx * pressRing;
  const targetPressY = player.y - ny * pressRing;
  const targetCutX = player.x + flankX * cutRing * escapeBias;
  const targetCutY = player.y + flankY * cutRing * escapeBias;

  const lerp = 0.028;
  presser.x += (targetPressX - presser.x) * lerp;
  presser.y += (targetPressY - presser.y) * lerp;
  cutter.x += (targetCutX - cutter.x) * lerp;
  cutter.y += (targetCutY - cutter.y) * lerp;

  SCRATCH_DUAL.x = cutter.x - presser.x;
  SCRATCH_DUAL.y = cutter.y - presser.y;
  const sep = Math.hypot(SCRATCH_DUAL.x, SCRATCH_DUAL.y) || 0.0001;
  const minDist = presser.hitRadius + cutter.hitRadius + 0.95;
  if (sep < minDist) {
    const push = (minDist - sep) * 0.5;
    const snx = SCRATCH_DUAL.x / sep;
    const sny = SCRATCH_DUAL.y / sep;
    presser.x -= snx * push;
    presser.y -= sny * push;
    cutter.x += snx * push;
    cutter.y += sny * push;
  }
}

export function getDesperationPhaseLabel(behavior: RaycastBossBehaviorId): string {
  if (behavior === 'ash-judge') return 'DESPERACIÓN // VEREDICTO FINAL';
  if (behavior === 'bloom-warden') return 'DESPERACIÓN // ENJAMBRE COLAPSANTE';
  return 'DESPERACIÓN // SOBRECARGA TOTAL';
}
