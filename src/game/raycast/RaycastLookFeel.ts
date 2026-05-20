import type { MovementVector } from '../systems/MovementSystem';
import { normalizeAngle } from './RaycastCombatSystem';
import type { RaycastEnemy } from './RaycastEnemy';
import { clampRaycastLookDelta } from './RaycastMovement';

export type AimAssistLevel = 'off' | 'low' | 'normal';

export interface AimAssistStrength {
  acquireRadians: number;
  magnetism: number;
  slowdown: number;
  friction: number;
}

export interface AimAssistTarget {
  enemyId: string;
  angleRadians: number;
  distance: number;
  angleErrorRadians: number;
}

export interface LookFeelSettings {
  aimAssist: AimAssistLevel;
  cameraSmoothing: number;
  stickSensitivity: number;
  touchLookSensitivity: number;
  gamepadLookDeadzone: number;
  touchDeadzone: number;
}

export interface LookFeelProcessorState {
  smoothedTurnRate: number;
  previousGamepadLookX: number;
  previousTouchLookX: number;
}

const AIM_ASSIST_PRESETS: Record<AimAssistLevel, AimAssistStrength> = {
  off: { acquireRadians: 0, magnetism: 0, slowdown: 0, friction: 0 },
  low: { acquireRadians: 0.12, magnetism: 0.09, slowdown: 0.24, friction: 0.14 },
  normal: { acquireRadians: 0.2, magnetism: 0.16, slowdown: 0.4, friction: 0.22 }
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function getAimAssistStrength(level: AimAssistLevel): AimAssistStrength {
  return AIM_ASSIST_PRESETS[level] ?? AIM_ASSIST_PRESETS.off;
}

export function cycleAimAssistLevel(level: AimAssistLevel, direction: number): AimAssistLevel {
  const order: AimAssistLevel[] = ['off', 'low', 'normal'];
  const index = order.indexOf(level);
  const next = (index + direction + order.length) % order.length;
  return order[next];
}

export function formatAimAssistLabel(level: AimAssistLevel): string {
  if (level === 'low') return 'BAJO';
  if (level === 'normal') return 'NORMAL';
  return 'OFF';
}

/** Radial deadzone with smooth rescale — used for sticks and drift gate. */
export function applyRadialDeadzone(x: number, y: number, deadzone: number): MovementVector {
  const magnitude = Math.hypot(x, y);
  const dz = clamp(deadzone, 0, 0.95);
  if (magnitude <= dz) return { x: 0, y: 0 };
  const scaled = (magnitude - dz) / (1 - dz);
  const scale = scaled / magnitude;
  return { x: x * scale, y: y * scale };
}

/** Exponential response curve — higher exponent = finer aim near center. */
export function applyStickResponseCurve(value: number, exponent = 1.65): number {
  if (!Number.isFinite(value)) return 0;
  const abs = Math.abs(value);
  if (abs === 0) return 0;
  const curved = Math.pow(abs, clamp(exponent, 1, 2.4));
  return Math.sign(value) * curved;
}

export function filterStickDrift(value: number, driftGate = 0.055): number {
  if (!Number.isFinite(value)) return 0;
  return Math.abs(value) < driftGate ? 0 : value;
}

export function processGamepadLookAxis(rawX: number, settings: Pick<LookFeelSettings, 'gamepadLookDeadzone' | 'stickSensitivity'>): number {
  const deadzoned = applyRadialDeadzone(rawX, 0, settings.gamepadLookDeadzone).x;
  const driftFree = filterStickDrift(deadzoned);
  const curved = applyStickResponseCurve(driftFree, 1.55 + settings.stickSensitivity * 0.12);
  return clamp(curved * settings.stickSensitivity, -1, 1);
}

export function clampLookSpike(deltaRadians: number, maxDeltaRadians: number): number {
  return clampRaycastLookDelta(deltaRadians, maxDeltaRadians);
}

export function smoothTurnRate(
  previousRate: number,
  targetRate: number,
  deltaSeconds: number,
  smoothing: number
): number {
  if (!Number.isFinite(targetRate)) return 0;
  const amount = clamp(smoothing, 0, 1);
  if (amount <= 0.001 || deltaSeconds <= 0) return targetRate;
  // Higher smoothing = lower alpha (more filtering) but capped to stay responsive.
  const alpha = clamp(1 - amount * 0.82, 0.22, 1);
  const frameAlpha = 1 - Math.pow(1 - alpha, Math.max(1, deltaSeconds * 60));
  return previousRate + (targetRate - previousRate) * frameAlpha;
}

export function findAimAssistTarget(
  playerX: number,
  playerY: number,
  playerAngle: number,
  enemies: RaycastEnemy[],
  wallDistance: number,
  acquireRadians: number
): AimAssistTarget | null {
  if (acquireRadians <= 0) return null;
  let best: AimAssistTarget | null = null;
  for (const enemy of enemies) {
    if (!enemy.alive) continue;
    const dx = enemy.x - playerX;
    const dy = enemy.y - playerY;
    const distance = Math.hypot(dx, dy);
    if (distance >= wallDistance) continue;
    const angleToEnemy = Math.atan2(dy, dx);
    const angleError = normalizeAngle(angleToEnemy - playerAngle);
    const tolerance = Math.max(acquireRadians, enemy.radius / Math.max(distance, 0.001));
    if (Math.abs(angleError) > tolerance) continue;
    if (!best || distance < best.distance) {
      best = {
        enemyId: enemy.id,
        angleRadians: angleToEnemy,
        distance,
        angleErrorRadians: angleError
      };
    }
  }
  return best;
}

export function applyAimAssistToTurnDelta(
  turnDeltaRadians: number,
  playerAngle: number,
  target: AimAssistTarget | null,
  level: AimAssistLevel,
  deltaSeconds: number
): number {
  if (level === 'off' || !target || turnDeltaRadians === 0 || deltaSeconds <= 0) return turnDeltaRadians;
  const strength = getAimAssistStrength(level);
  const absError = Math.abs(target.angleErrorRadians);
  if (absError > strength.acquireRadians * 1.25) return turnDeltaRadians;

  const proximity = 1 - clamp(absError / strength.acquireRadians, 0, 1);
  const slowdown = 1 - strength.slowdown * proximity;
  const friction = 1 - strength.friction * proximity * 0.45;
  const magnetPull =
    target.angleErrorRadians * strength.magnetism * (0.25 + proximity * 0.75) * clamp(deltaSeconds * 14, 0.35, 1.15);

  return turnDeltaRadians * slowdown * friction + magnetPull;
}

export function createLookFeelProcessorState(): LookFeelProcessorState {
  return {
    smoothedTurnRate: 0,
    previousGamepadLookX: 0,
    previousTouchLookX: 0
  };
}

export interface ProcessLookTurnInput {
  turnDeltaRadians: number;
  state: LookFeelProcessorState;
}

export function processLookTurnDelta(options: {
  rawGamepadLookX: number;
  rawTouchLookXRadians: number;
  keyboardTurnAxis: number;
  turnSpeed: number;
  deltaSeconds: number;
  settings: LookFeelSettings;
  state: LookFeelProcessorState;
  aimTarget: AimAssistTarget | null;
  playerAngle: number;
  useGamepadAimAssist: boolean;
  useTouchAimAssist: boolean;
  maxDeltaRadians?: number;
}): ProcessLookTurnInput {
  const {
    rawGamepadLookX,
    rawTouchLookXRadians,
    keyboardTurnAxis,
    turnSpeed,
    deltaSeconds,
    settings,
    state,
    aimTarget,
    playerAngle,
    useGamepadAimAssist,
    useTouchAimAssist,
    maxDeltaRadians = Math.PI * 0.35
  } = options;

  const gamepadStick = processGamepadLookAxis(rawGamepadLookX, settings);
  const gamepadDelta = gamepadStick * turnSpeed * deltaSeconds;
  const touchDelta = clampLookSpike(rawTouchLookXRadians * settings.touchLookSensitivity, maxDeltaRadians);
  const keyboardDelta = keyboardTurnAxis * turnSpeed * deltaSeconds;

  let assistedGamepad = gamepadDelta;
  let assistedTouch = touchDelta;
  if (useGamepadAimAssist && Math.abs(gamepadDelta) > 0.00001) {
    assistedGamepad = applyAimAssistToTurnDelta(gamepadDelta, playerAngle, aimTarget, settings.aimAssist, deltaSeconds);
  } else if (useTouchAimAssist && Math.abs(touchDelta) > 0.00001) {
    assistedTouch = applyAimAssistToTurnDelta(touchDelta, playerAngle, aimTarget, settings.aimAssist, deltaSeconds);
  }
  let rawDelta = keyboardDelta + assistedGamepad + assistedTouch;

  rawDelta = clampLookSpike(rawDelta, maxDeltaRadians);
  const targetRate = deltaSeconds > 0 ? rawDelta / deltaSeconds : 0;
  const smoothedRate = smoothTurnRate(state.smoothedTurnRate, targetRate, deltaSeconds, settings.cameraSmoothing);
  state.smoothedTurnRate = smoothedRate;
  state.previousGamepadLookX = gamepadStick;
  state.previousTouchLookX = touchDelta;

  return {
    turnDeltaRadians: smoothedRate * deltaSeconds,
    state
  };
}
