import { describe, expect, it } from 'vitest';
import type { RaycastEnemy } from '../game/raycast/RaycastEnemy';
import {
  applyAimAssistToTurnDelta,
  applyRadialDeadzone,
  applyStickResponseCurve,
  clampLookSpike,
  filterStickDrift,
  findAimAssistTarget,
  getAimAssistStrength,
  processGamepadLookAxis,
  processLookTurnDelta,
  smoothTurnRate,
  createLookFeelProcessorState
} from '../game/raycast/RaycastLookFeel';

function mockEnemy(id: string, x: number, y: number): RaycastEnemy {
  return {
    id,
    kind: 'GRUNT',
    x,
    y,
    health: 50,
    maxHealth: 50,
    alive: true,
    radius: 0.35,
    color: 0xffffff,
    lastAttack: 0,
    spawnTelegraphStartedAt: 0,
    spawnTelegraphUntil: 0,
    attackWindupStartedAt: 0,
    attackWindupUntil: 0,
    staggerUntil: 0,
    hitFlashUntil: 0,
    flinchOffsetRad: 0,
    deathBurstUntil: 0,
    patrolWaypoints: [],
    patrolWaypointIndex: 0,
    alertUntilTime: 0,
    lastKnownPlayerX: 0,
    lastKnownPlayerY: 0,
    wasCombatActiveLastTick: false,
    roamHeadingRad: 0,
    roamNextRedirectAt: 0,
    roamStuckMs: 0
  };
}

describe('raycast look feel', () => {
  it('applies radial deadzone and drift filtering', () => {
    expect(applyRadialDeadzone(0.1, 0, 0.18).x).toBe(0);
    expect(applyRadialDeadzone(0.5, 0, 0.18).x).toBeGreaterThan(0.2);
    expect(filterStickDrift(0.03)).toBe(0);
    expect(filterStickDrift(0.12)).toBe(0.12);
  });

  it('curves stick response for finer center aim', () => {
    expect(Math.abs(applyStickResponseCurve(0.5))).toBeLessThan(0.5);
    expect(Math.abs(applyStickResponseCurve(1))).toBe(1);
  });

  it('clamps look spikes', () => {
    expect(Math.abs(clampLookSpike(99, 0.2))).toBeLessThanOrEqual(0.2);
  });

  it('smooths turn rate without freezing input', () => {
    const first = smoothTurnRate(0, 1.2, 1 / 60, 0.35);
    const settled = smoothTurnRate(first, 1.2, 1 / 60, 0.35);
    expect(first).toBeGreaterThan(0);
    expect(settled).toBeGreaterThan(first);
    expect(settled).toBeLessThanOrEqual(1.2);
  });

  it('acquires aim assist targets within cone', () => {
    const target = findAimAssistTarget(2, 2, 0, [mockEnemy('a', 5, 2)], 20, getAimAssistStrength('normal').acquireRadians);
    expect(target?.enemyId).toBe('a');
    expect(Math.abs(target?.angleErrorRadians ?? 0)).toBeLessThan(0.25);
  });

  it('applies magnetism and slowdown when assist is enabled', () => {
    const target = findAimAssistTarget(0, 0, 0, [mockEnemy('a', 4, 0.2)], 20, 0.2)!;
    const assisted = applyAimAssistToTurnDelta(0.05, 0, target, 'normal', 1 / 60);
    expect(Math.abs(assisted)).not.toBe(0.05);
  });

  it('processes gamepad look with deadzone and sensitivity', () => {
    expect(processGamepadLookAxis(0.08, { gamepadLookDeadzone: 0.18, stickSensitivity: 1 })).toBe(0);
    expect(processGamepadLookAxis(0.9, { gamepadLookDeadzone: 0.18, stickSensitivity: 1.2 })).toBeGreaterThan(0.5);
  });

  it('applies aim assist only to gamepad or touch deltas', () => {
    const settings = {
      aimAssist: 'normal' as const,
      cameraSmoothing: 0,
      stickSensitivity: 1,
      touchLookSensitivity: 1,
      gamepadLookDeadzone: 0.18,
      touchDeadzone: 0.18
    };
    const target = findAimAssistTarget(0, 0, 0, [mockEnemy('a', 4, 0.2)], 20, 0.2)!;
    const state = createLookFeelProcessorState();
    const gamepadOnly = processLookTurnDelta({
      rawGamepadLookX: 0.85,
      rawTouchLookXRadians: 0,
      keyboardTurnAxis: 0,
      turnSpeed: 2.4,
      deltaSeconds: 1 / 60,
      settings,
      state,
      aimTarget: target,
      playerAngle: 0,
      useGamepadAimAssist: true,
      useTouchAimAssist: false
    });
    const keyboardOnly = processLookTurnDelta({
      rawGamepadLookX: 0,
      rawTouchLookXRadians: 0,
      keyboardTurnAxis: 1,
      turnSpeed: 2.4,
      deltaSeconds: 1 / 60,
      settings,
      state: createLookFeelProcessorState(),
      aimTarget: target,
      playerAngle: 0,
      useGamepadAimAssist: false,
      useTouchAimAssist: false
    });
    expect(Math.abs(gamepadOnly.turnDeltaRadians)).toBeGreaterThan(0);
    expect(Math.abs(keyboardOnly.turnDeltaRadians)).toBeCloseTo((2.4 * 1) / 60, 4);
  });
});
