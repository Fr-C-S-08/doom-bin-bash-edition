import type { EnemyKind } from '../types/game';
import type { RaycastEnemy } from './RaycastEnemy';
import type { RaycastEnemyVariant } from './RaycastEnemyVariants';

/** Player-facing color lane — maps to retro billboard read (no new shaders). */
export type RaycastCombatRoleColor = 'red' | 'purple' | 'blue' | 'green' | 'yellow';

export interface RaycastEnemyIdentityProfile {
  kind: EnemyKind;
  roleColor: RaycastCombatRoleColor;
  codename: string;
  roleTitle: string;
  identityColor: number;
  telegraphColor: number;
  windupColor: number;
  spawnAudioPitchMul: number;
  attackAudioPitchMul: number;
  spawnTellBonusMs: number;
  isDisruptor: boolean;
  isSupport: boolean;
}

export const RAYCAST_ENEMY_READABILITY = {
  minBillboardVisibility: 0.72,
  minBillboardSize: 18,
  eliteAuraAlpha: 0.48,
  eliteAuraScale: 1.34,
  spawnTellVisibleBonusMs: 120,
  spawnTellCloseBonusMs: 180
} as const;

/** Rare elite spawn — memorable, not routine. */
export const RAYCAST_ELITE_SPAWN_BASE_CHANCE = 0.055;
export const RAYCAST_ELITE_KILL_SCORE_BONUS = 90;

/** Cap disruptor density so flash/harass lanes stay readable. */
export const RAYCAST_MAX_DISRUPTOR_RATIO = 0.3;
export const RAYCAST_MAX_ARTILLERY_RATIO = 0.36;

const DISRUPTOR_KINDS: readonly EnemyKind[] = ['FLASHER', 'SCRAMBLER'];
const ARTILLERY_KINDS: readonly EnemyKind[] = ['RANGED'];
const PRESSURE_KINDS: readonly EnemyKind[] = ['GRUNT', 'STALKER', 'BRUTE'];

export const RAYCAST_ENEMY_IDENTITY: Record<EnemyKind, RaycastEnemyIdentityProfile> = {
  GRUNT: {
    kind: 'GRUNT',
    roleColor: 'red',
    codename: 'SCAV',
    roleTitle: 'BERSERKER',
    identityColor: 0xff4a38,
    telegraphColor: 0xff6a58,
    windupColor: 0xff8a72,
    spawnAudioPitchMul: 1.06,
    attackAudioPitchMul: 1.04,
    spawnTellBonusMs: 0,
    isDisruptor: false,
    isSupport: false
  },
  STALKER: {
    kind: 'STALKER',
    roleColor: 'purple',
    codename: 'STALK',
    roleTitle: 'FLANKER',
    identityColor: 0x9f6aff,
    telegraphColor: 0xc4a0ff,
    windupColor: 0xe0c4ff,
    spawnAudioPitchMul: 1.12,
    attackAudioPitchMul: 1.08,
    spawnTellBonusMs: 40,
    isDisruptor: false,
    isSupport: false
  },
  RANGED: {
    kind: 'RANGED',
    roleColor: 'blue',
    codename: 'TURRET',
    roleTitle: 'TRACKER',
    identityColor: 0x48d8ff,
    telegraphColor: 0x7ae8ff,
    windupColor: 0xa8f4ff,
    spawnAudioPitchMul: 0.94,
    attackAudioPitchMul: 0.98,
    spawnTellBonusMs: 60,
    isDisruptor: false,
    isSupport: false
  },
  BRUTE: {
    kind: 'BRUTE',
    roleColor: 'green',
    codename: 'BRUTE',
    roleTitle: 'TANK',
    identityColor: 0x5fd86a,
    telegraphColor: 0x88f090,
    windupColor: 0xa8ffb0,
    spawnAudioPitchMul: 0.82,
    attackAudioPitchMul: 0.86,
    spawnTellBonusMs: 80,
    isDisruptor: false,
    isSupport: false
  },
  SCRAMBLER: {
    kind: 'SCRAMBLER',
    roleColor: 'yellow',
    codename: 'SCRAM',
    roleTitle: 'SUPPORT',
    identityColor: 0xffd84a,
    telegraphColor: 0xffec88,
    windupColor: 0xfff6b8,
    spawnAudioPitchMul: 1.08,
    attackAudioPitchMul: 1.02,
    spawnTellBonusMs: 30,
    isDisruptor: true,
    isSupport: true
  },
  FLASHER: {
    kind: 'FLASHER',
    roleColor: 'purple',
    codename: 'FLASH',
    roleTitle: 'DISRUPTOR',
    identityColor: 0xc17cff,
    telegraphColor: 0xe8b8ff,
    windupColor: 0xf2d4ff,
    spawnAudioPitchMul: 1.16,
    attackAudioPitchMul: 1.1,
    spawnTellBonusMs: 50,
    isDisruptor: true,
    isSupport: false
  }
};

const ELITE_NAMES: Record<EnemyKind, readonly string[]> = {
  GRUNT: ['REAVER', 'BLOOD HOUND', 'RUST FIEND'],
  STALKER: ['PHANTOM', 'SLIP WRAITH', 'NEEDLE'],
  RANGED: ['SNIPER', 'BEAM CAST', 'LOCK ON'],
  BRUTE: ['IRON MAW', 'BULK SENTINEL', 'RAM PLATE'],
  SCRAMBLER: ['HIVE NODE', 'SIGNAL SAINT', 'RELAY'],
  FLASHER: ['STROBE', 'MIND SPIKE', 'AFTERIMAGE']
};

export function getRaycastEnemyIdentity(kind: EnemyKind): RaycastEnemyIdentityProfile {
  return RAYCAST_ENEMY_IDENTITY[kind];
}

export function getRaycastEnemyIdentityColor(kind: EnemyKind): number {
  return RAYCAST_ENEMY_IDENTITY[kind].identityColor;
}

export function isDisruptorKind(kind: EnemyKind): boolean {
  return RAYCAST_ENEMY_IDENTITY[kind].isDisruptor;
}

export function countAliveByKind(enemies: readonly Pick<RaycastEnemy, 'alive' | 'kind'>[]): Record<EnemyKind, number> {
  const counts: Record<EnemyKind, number> = {
    GRUNT: 0,
    BRUTE: 0,
    STALKER: 0,
    RANGED: 0,
    SCRAMBLER: 0,
    FLASHER: 0
  };
  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i];
    if (!enemy.alive) continue;
    counts[enemy.kind] += 1;
  }
  return counts;
}

export function getCompositionRatios(counts: Record<EnemyKind, number>): {
  total: number;
  disruptorRatio: number;
  artilleryRatio: number;
  pressureRatio: number;
} {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (total <= 0) {
    return { total: 0, disruptorRatio: 0, artilleryRatio: 0, pressureRatio: 0 };
  }
  let disruptors = 0;
  let artillery = 0;
  let pressure = 0;
  for (const kind of DISRUPTOR_KINDS) disruptors += counts[kind];
  for (const kind of ARTILLERY_KINDS) artillery += counts[kind];
  for (const kind of PRESSURE_KINDS) pressure += counts[kind];
  return {
    total,
    disruptorRatio: disruptors / total,
    artilleryRatio: artillery / total,
    pressureRatio: pressure / total
  };
}

/** Mini director — swap unfair spawns for readable compositions. */
export function adjustDirectorSpawnKind(
  requested: EnemyKind,
  counts: Record<EnemyKind, number>,
  rng: () => number
): EnemyKind {
  const { total, disruptorRatio, artilleryRatio, pressureRatio } = getCompositionRatios(counts);
  if (total <= 0) return requested;

  if (isDisruptorKind(requested) && disruptorRatio >= RAYCAST_MAX_DISRUPTOR_RATIO) {
    return rng() < 0.55 ? 'GRUNT' : 'STALKER';
  }
  if (ARTILLERY_KINDS.includes(requested) && artilleryRatio >= RAYCAST_MAX_ARTILLERY_RATIO) {
    return rng() < 0.5 ? 'GRUNT' : 'BRUTE';
  }
  if (total >= 5 && pressureRatio < 0.22 && !PRESSURE_KINDS.includes(requested)) {
    return rng() < 0.65 ? 'GRUNT' : 'BRUTE';
  }
  return requested;
}

export interface RaycastVariantRollResult {
  variant: RaycastEnemyVariant;
  kind: EnemyKind;
  eliteDisplayName?: string;
}

export function pickEliteDisplayName(kind: EnemyKind, rng: () => number): string {
  const pool = ELITE_NAMES[kind];
  const idx = Math.floor(rng() * pool.length) % pool.length;
  return pool[idx] ?? 'ELITE';
}

export function rollRaycastEnemyVariant(
  kind: EnemyKind,
  rng: () => number,
  indexSeed = 0,
  eliteRateBonus = 0
): RaycastVariantRollResult {
  const roll = (rng() + indexSeed * 0.037) % 1;
  let variant: RaycastEnemyVariant = 'BASE';
  let nextKind = kind;
  let eliteDisplayName: string | undefined;

  const eliteChance = RAYCAST_ELITE_SPAWN_BASE_CHANCE + eliteRateBonus;
  if (roll < eliteChance) {
    variant = 'ELITE';
    eliteDisplayName = pickEliteDisplayName(kind, rng);
  } else if (kind === 'RANGED' && roll < eliteChance + 0.24) variant = 'SNIPER';
  else if (kind === 'SCRAMBLER' && roll < eliteChance + 0.18) variant = 'EXPLODER';
  else if (kind === 'GRUNT' && roll < eliteChance + 0.14) variant = 'BERSERK';
  else if ((kind === 'GRUNT' || kind === 'BRUTE') && roll >= eliteChance + 0.14 && roll < eliteChance + 0.26) {
    variant = 'SHIELDED';
  } else if (roll > 0.9) variant = 'CORRUPTED';

  if (variant === 'BASE' && roll > 0.94 && nextKind === 'STALKER') nextKind = 'FLASHER';

  return { variant, kind: nextKind, eliteDisplayName };
}

export function formatRaycastEnemyIdentityLabel(
  enemy: Pick<RaycastEnemy, 'kind' | 'variant'> & { eliteDisplayName?: string }
): string {
  const identity = getRaycastEnemyIdentity(enemy.kind);
  if (enemy.variant === 'ELITE' && enemy.eliteDisplayName) {
    return `★${enemy.eliteDisplayName}·${identity.roleTitle}`;
  }
  if (enemy.variant === 'BERSERK') return `${identity.codename}·RAGE`;
  if (enemy.variant === 'SNIPER') return `${identity.codename}·SNIP`;
  if (enemy.variant === 'SHIELDED') return `${identity.codename}·SHLD`;
  if (enemy.variant === 'EXPLODER') return `${identity.codename}·BURST`;
  if (enemy.variant === 'CORRUPTED') return `${identity.codename}·COR`;
  return `${identity.codename}·${identity.roleTitle}`;
}

export function getRaycastSpawnTelegraphMs(input: {
  baseMs: number;
  kind: EnemyKind;
  visibleToPlayer: boolean;
  distanceToPlayer: number;
}): number {
  const profile = getRaycastEnemyIdentity(input.kind);
  let ms = input.baseMs + profile.spawnTellBonusMs;
  if (input.visibleToPlayer) ms += RAYCAST_ENEMY_READABILITY.spawnTellVisibleBonusMs;
  if (input.distanceToPlayer <= 5.5) ms += RAYCAST_ENEMY_READABILITY.spawnTellCloseBonusMs;
  return ms;
}

export function getRaycastEliteKillScoreBonus(enemies: readonly RaycastEnemy[], time: number): number {
  let bonus = 0;
  for (let i = 0; i < enemies.length; i += 1) {
    const enemy = enemies[i];
    if (enemy.alive || enemy.variant !== 'ELITE') continue;
    if (enemy.deathBurstUntil > time - 120) bonus += RAYCAST_ELITE_KILL_SCORE_BONUS;
  }
  return bonus;
}
