import type { WeaponKind } from '../systems/WeaponTypes';
import type { RaycastEnemy } from './RaycastEnemy';
import { RAYCAST_DEATH_BURST_MS, RAYCAST_HIT_FLASH_MS } from './RaycastCombatSystem';

export const RAYCAST_KILL_FREEZE_MS = 42;
export const RAYCAST_BOSS_KILL_FREEZE_MS = 68;
export const RAYCAST_CORPSE_FADE_MS = 320;

export interface WeaponFeelProfile {
  recoilKickMax: number;
  recoilRecoveryPerSec: number;
  bobAmplitudeX: number;
  bobAmplitudeY: number;
  bobFrequencyHz: number;
  idleSwayAmplitudeX: number;
  idleSwayAmplitudeY: number;
  idleSwayFrequencyHz: number;
  cameraKickRad: number;
  shellEjectDelayMs: number;
  shellVisibleMs: number;
  reloadDropPx: number;
  reloadTiltRad: number;
  switchBlendMs: number;
  hitFlinchMul: number;
  muzzleFlashDecayMs: number;
}

export const RAYCAST_WEAPON_FEEL: Record<WeaponKind, WeaponFeelProfile> = {
  PISTOL: {
    recoilKickMax: 1,
    recoilRecoveryPerSec: 11.5,
    bobAmplitudeX: 2.2,
    bobAmplitudeY: 3.4,
    bobFrequencyHz: 1.85,
    idleSwayAmplitudeX: 1.1,
    idleSwayAmplitudeY: 1.6,
    idleSwayFrequencyHz: 0.42,
    cameraKickRad: 0.0048,
    shellEjectDelayMs: 38,
    shellVisibleMs: 148,
    reloadDropPx: 18,
    reloadTiltRad: 0.038,
    switchBlendMs: 220,
    hitFlinchMul: 0.11,
    muzzleFlashDecayMs: 72
  },
  SHOTGUN: {
    recoilKickMax: 1,
    recoilRecoveryPerSec: 7.2,
    bobAmplitudeX: 3.6,
    bobAmplitudeY: 5.2,
    bobFrequencyHz: 1.55,
    idleSwayAmplitudeX: 1.8,
    idleSwayAmplitudeY: 2.4,
    idleSwayFrequencyHz: 0.36,
    cameraKickRad: 0.0115,
    shellEjectDelayMs: 52,
    shellVisibleMs: 210,
    reloadDropPx: 28,
    reloadTiltRad: 0.055,
    switchBlendMs: 280,
    hitFlinchMul: 0.2,
    muzzleFlashDecayMs: 142
  },
  LAUNCHER: {
    recoilKickMax: 1,
    recoilRecoveryPerSec: 5.4,
    bobAmplitudeX: 2.8,
    bobAmplitudeY: 4.6,
    bobFrequencyHz: 1.35,
    idleSwayAmplitudeX: 1.4,
    idleSwayAmplitudeY: 2.1,
    idleSwayFrequencyHz: 0.3,
    cameraKickRad: 0.0145,
    shellEjectDelayMs: 0,
    shellVisibleMs: 0,
    reloadDropPx: 34,
    reloadTiltRad: 0.072,
    switchBlendMs: 320,
    hitFlinchMul: 0.24,
    muzzleFlashDecayMs: 228
  }
};

export interface CombatFeelRuntimeState {
  recoilKick: number;
  bobPhase: number;
  switchBlend: number;
  switchFromWeapon: WeaponKind | null;
  switchUntilMs: number;
  shellVisibleUntilMs: number;
  lastShotAtMs: number;
  cameraKickRad: number;
}

export interface WeaponViewFeel {
  offsetX: number;
  offsetY: number;
  tiltRad: number;
  swayX: number;
  swayY: number;
  bobX: number;
  bobY: number;
  reloadDrop: number;
  switchBlend: number;
  shellPhase: number;
  recoilKick: number;
}

export interface HitMarkerFeedbackTiming {
  durationMs: number;
  scaleStart: number;
  scaleEnd: number;
}

export interface DeathFeedbackProfile {
  freezeMs: number;
  burstScaleMul: number;
  corpseFadeMs: number;
  burstDurationMs: number;
}

export interface CombatImpactAudioOptions {
  pitchMul: number;
  intensityMul: number;
  lowFreqBoost: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getWeaponFeelProfile(weapon: WeaponKind): WeaponFeelProfile {
  return RAYCAST_WEAPON_FEEL[weapon] ?? RAYCAST_WEAPON_FEEL.PISTOL;
}

export function getRecoilBounds(weapon: WeaponKind): { min: number; max: number } {
  return { min: 0, max: getWeaponFeelProfile(weapon).recoilKickMax };
}

export function createCombatFeelRuntimeState(): CombatFeelRuntimeState {
  return {
    recoilKick: 0,
    bobPhase: 0,
    switchBlend: 0,
    switchFromWeapon: null,
    switchUntilMs: 0,
    shellVisibleUntilMs: 0,
    lastShotAtMs: 0,
    cameraKickRad: 0
  };
}

export function applyWeaponFireFeel(state: CombatFeelRuntimeState, weapon: WeaponKind, timeMs: number): void {
  const profile = getWeaponFeelProfile(weapon);
  state.recoilKick = clamp(state.recoilKick + 0.42 + profile.recoilKickMax * 0.58, 0, profile.recoilKickMax);
  state.lastShotAtMs = timeMs;
  state.cameraKickRad = clamp(state.cameraKickRad + profile.cameraKickRad, 0, profile.cameraKickRad * 2.4);
  if (profile.shellVisibleMs > 0) {
    state.shellVisibleUntilMs = timeMs + profile.shellEjectDelayMs + profile.shellVisibleMs;
  }
}

export function applyWeaponSwitchFeel(
  state: CombatFeelRuntimeState,
  fromWeapon: WeaponKind,
  toWeapon: WeaponKind,
  timeMs: number
): void {
  if (fromWeapon === toWeapon) return;
  const profile = getWeaponFeelProfile(toWeapon);
  state.switchFromWeapon = fromWeapon;
  state.switchBlend = 1;
  state.switchUntilMs = timeMs + profile.switchBlendMs;
  state.recoilKick *= 0.35;
}

export function tickCombatFeelRuntime(
  state: CombatFeelRuntimeState,
  timeMs: number,
  deltaSeconds: number,
  moving: boolean,
  weapon: WeaponKind,
  reloadBlend: number
): void {
  const profile = getWeaponFeelProfile(weapon);
  const recovery = profile.recoilRecoveryPerSec * deltaSeconds;
  state.recoilKick = clamp(state.recoilKick - recovery * (0.55 + state.recoilKick * 0.45), 0, profile.recoilKickMax);
  state.cameraKickRad = clamp(state.cameraKickRad - deltaSeconds * profile.cameraKickRad * 14, 0, profile.cameraKickRad * 2.4);

  const bobRate = moving ? profile.bobFrequencyHz * Math.PI * 2 : profile.idleSwayFrequencyHz * Math.PI * 2;
  state.bobPhase += bobRate * deltaSeconds;

  if (state.switchUntilMs > timeMs) {
    const remaining = state.switchUntilMs - timeMs;
    state.switchBlend = clamp(remaining / profile.switchBlendMs, 0, 1);
  } else {
    state.switchBlend = 0;
    state.switchFromWeapon = null;
  }

  if (reloadBlend > 0.02) {
    state.recoilKick = clamp(state.recoilKick * (1 - reloadBlend * 0.35), 0, profile.recoilKickMax);
  }

  void moving;
  void timeMs;
  if (state.shellVisibleUntilMs > 0 && timeMs >= state.shellVisibleUntilMs) {
    state.shellVisibleUntilMs = 0;
  }
}

export function buildWeaponViewFeel(
  state: CombatFeelRuntimeState,
  weapon: WeaponKind,
  timeMs: number,
  moving: boolean,
  reloadBlend: number,
  muzzleAlpha: number
): WeaponViewFeel {
  const profile = getWeaponFeelProfile(weapon);
  const kick = clamp(Math.max(state.recoilKick, muzzleAlpha * 0.92), 0, profile.recoilKickMax);
  const recoilY = kick * (weapon === 'SHOTGUN' ? 34 : weapon === 'LAUNCHER' ? 38 : 8.5);
  const recoilX = kick * (weapon === 'SHOTGUN' ? 14 : weapon === 'LAUNCHER' ? 10 : 2.8);

  const bobAmpX = moving ? profile.bobAmplitudeX : profile.idleSwayAmplitudeX;
  const bobAmpY = moving ? profile.bobAmplitudeY : profile.idleSwayAmplitudeY;
  const bobX = Math.sin(state.bobPhase) * bobAmpX;
  const bobY = Math.abs(Math.cos(state.bobPhase * 0.5)) * bobAmpY;

  const reloadWave = reloadBlend > 0 ? Math.sin(reloadBlend * Math.PI) : 0;
  const reloadDrop = profile.reloadDropPx * reloadWave;
  const tiltRad = profile.reloadTiltRad * reloadWave * (weapon === 'LAUNCHER' ? 1 : 0.85);

  let shellPhase = 0;
  if (state.shellVisibleUntilMs > timeMs && profile.shellVisibleMs > 0) {
    const total = profile.shellEjectDelayMs + profile.shellVisibleMs;
    const remaining = state.shellVisibleUntilMs - timeMs;
    shellPhase = clamp(remaining / total, 0, 1);
  }

  return {
    offsetX: recoilX + bobX,
    offsetY: recoilY + bobY + reloadDrop,
    tiltRad,
    swayX: bobX * 0.35,
    swayY: bobY * 0.25,
    bobX,
    bobY,
    reloadDrop,
    switchBlend: state.switchBlend,
    shellPhase,
    recoilKick: kick
  };
}

export function getMuzzleFlashDecayMs(weapon: WeaponKind): number {
  return getWeaponFeelProfile(weapon).muzzleFlashDecayMs;
}

export function getHitMarkerFeedbackTiming(killed: boolean, crit: boolean, splash: boolean): HitMarkerFeedbackTiming {
  if (killed) return { durationMs: 196, scaleStart: 1.68, scaleEnd: 2.18 };
  if (crit) return { durationMs: 136, scaleStart: 1.46, scaleEnd: 1.92 };
  if (splash) return { durationMs: 112, scaleStart: 1.16, scaleEnd: 1.58 };
  return { durationMs: 102, scaleStart: 1.08, scaleEnd: 1.52 };
}

export function getDeathFeedbackProfile(isBoss: boolean): DeathFeedbackProfile {
  if (isBoss) {
    return {
      freezeMs: RAYCAST_BOSS_KILL_FREEZE_MS,
      burstScaleMul: 1.55,
      corpseFadeMs: RAYCAST_CORPSE_FADE_MS + 120,
      burstDurationMs: RAYCAST_DEATH_BURST_MS + 140
    };
  }
  return {
    freezeMs: RAYCAST_KILL_FREEZE_MS,
    burstScaleMul: 1.22,
    corpseFadeMs: RAYCAST_CORPSE_FADE_MS,
    burstDurationMs: RAYCAST_DEATH_BURST_MS
  };
}

export function shouldSkipGameplayDuringFreeze(timeMs: number, freezeUntilMs: number): boolean {
  return freezeUntilMs > timeMs;
}

export function applyEnemyHitFlinch(enemy: RaycastEnemy, weapon: WeaponKind, isCrit: boolean): void {
  const profile = getWeaponFeelProfile(weapon);
  const impulse = profile.hitFlinchMul * (isCrit ? 1.35 : 1);
  const sign = enemy.id.charCodeAt(0) % 2 === 0 ? 1 : -1;
  enemy.flinchOffsetRad = clamp((enemy.flinchOffsetRad ?? 0) + impulse * sign, -0.22, 0.22);
}

export function decayEnemyFlinch(enemy: RaycastEnemy, deltaSeconds: number): void {
  const current = enemy.flinchOffsetRad ?? 0;
  if (Math.abs(current) < 0.0005) {
    enemy.flinchOffsetRad = 0;
    return;
  }
  enemy.flinchOffsetRad = current * Math.pow(0.08, deltaSeconds);
}

export function getEnemyFlinchScreenOffset(enemy: RaycastEnemy, billboardSize: number, timeMs: number): number {
  const flashBlend =
    enemy.hitFlashUntil > timeMs
      ? clamp((enemy.hitFlashUntil - timeMs) / RAYCAST_HIT_FLASH_MS, 0, 1)
      : 0;
  const flinchRad = enemy.flinchOffsetRad ?? 0;
  const wobble = Math.sin(timeMs * 0.018) * flashBlend * 0.35;
  return (flinchRad + wobble) * billboardSize * 1.15;
}

export function getCorpseFadeAlpha(enemy: RaycastEnemy, timeMs: number): number {
  if (enemy.alive || enemy.deathBurstUntil <= 0) return 0;
  if (timeMs <= enemy.deathBurstUntil) return 1;
  const fadeEnd = enemy.deathBurstUntil + RAYCAST_CORPSE_FADE_MS;
  if (timeMs >= fadeEnd) return 0;
  const t = (timeMs - enemy.deathBurstUntil) / RAYCAST_CORPSE_FADE_MS;
  return clamp(1 - t, 0, 1);
}

export function getCombatImpactAudioOptions(
  weapon: WeaponKind,
  killed: boolean,
  crit: boolean
): CombatImpactAudioOptions {
  const basePitch = 0.97 + (weapon === 'PISTOL' ? 0.02 : weapon === 'SHOTGUN' ? -0.01 : 0);
  const pitchJitter = killed ? 0.04 : crit ? 0.03 : 0.025;
  return {
    pitchMul: basePitch + (Math.random() * 2 - 1) * pitchJitter,
    intensityMul: killed ? 1.06 : crit ? 1.02 : weapon === 'SHOTGUN' ? 0.96 : 0.92,
    lowFreqBoost: weapon === 'SHOTGUN' ? 1.18 : weapon === 'LAUNCHER' ? 1.08 : 1
  };
}

export function getWeaponFireAudioPitch(weapon: WeaponKind): number {
  const spread = weapon === 'SHOTGUN' ? 0.035 : weapon === 'LAUNCHER' ? 0.028 : 0.04;
  return 1 + (Math.random() * 2 - 1) * spread;
}
