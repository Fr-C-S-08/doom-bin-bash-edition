import { describe, expect, it } from 'vitest';
import {
  formatRaycastActiveInputLine,
  formatRaycastControlsHelpBlock,
  isRaycastAimAssistInputKind,
  resolveRaycastActiveInput
} from '../game/raycast/RaycastInputHelp';
import {
  applyAimAssistToTurnDelta,
  createLookFeelProcessorState,
  findAimAssistTarget,
  processLookTurnDelta
} from '../game/raycast/RaycastLookFeel';
import type { RaycastEnemy } from '../game/raycast/RaycastEnemy';

function mockEnemy(): RaycastEnemy {
  return {
    id: 'a',
    kind: 'GRUNT',
    x: 4,
    y: 0.2,
    health: 10,
    maxHealth: 10,
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

describe('raycast input help', () => {
  it('resolves active input with touch and gamepad priority', () => {
    expect(
      resolveRaycastActiveInput({ gamepadConnected: true, touchActive: true, touchControlsEnabled: true })
    ).toBe('touch');
    expect(resolveRaycastActiveInput({ gamepadConnected: true, touchActive: false, touchControlsEnabled: true })).toBe(
      'gamepad'
    );
    expect(
      resolveRaycastActiveInput({ gamepadConnected: false, touchActive: false, touchControlsEnabled: true })
    ).toBe('keyboard_mouse');
  });

  it('keeps last detected input while device remains valid', () => {
    expect(
      resolveRaycastActiveInput(
        { gamepadConnected: true, touchActive: true, touchControlsEnabled: true },
        'gamepad'
      )
    ).toBe('gamepad');
  });

  it('formats active input and contextual control help', () => {
    expect(formatRaycastActiveInputLine('gamepad')).toContain('control');
    expect(formatRaycastControlsHelpBlock('touch')).toContain('Joystick');
  });

  it('limits aim assist eligibility to gamepad and touch', () => {
    expect(isRaycastAimAssistInputKind('gamepad')).toBe(true);
    expect(isRaycastAimAssistInputKind('touch')).toBe(true);
    expect(isRaycastAimAssistInputKind('keyboard_mouse')).toBe(false);
  });
});

describe('aim assist input safety', () => {
  const settings = {
    aimAssist: 'normal' as const,
    cameraSmoothing: 0,
    stickSensitivity: 1,
    touchLookSensitivity: 1,
    gamepadLookDeadzone: 0.18,
    touchDeadzone: 0.18
  };

  it('does not apply aim assist to keyboard-only turn deltas', () => {
    const target = findAimAssistTarget(0, 0, 0, [mockEnemy()], 20, 0.2)!;
    const keyboardDelta = (2.4 * 1) / 60;
    const result = processLookTurnDelta({
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
    expect(result.turnDeltaRadians).toBeCloseTo(keyboardDelta, 5);
    const rawAssist = applyAimAssistToTurnDelta(keyboardDelta, 0, target, 'normal', 1 / 60);
    expect(Math.abs(rawAssist - keyboardDelta)).toBeGreaterThan(0.0001);
  });

  it('applies aim assist when touch aim flag is set', () => {
    const target = findAimAssistTarget(0, 0, 0, [mockEnemy()], 20, 0.2)!;
    const touchOnly = processLookTurnDelta({
      rawGamepadLookX: 0,
      rawTouchLookXRadians: 0.04,
      keyboardTurnAxis: 0,
      turnSpeed: 2.4,
      deltaSeconds: 1 / 60,
      settings,
      state: createLookFeelProcessorState(),
      aimTarget: target,
      playerAngle: 0,
      useGamepadAimAssist: false,
      useTouchAimAssist: true
    });
    const touchNoAssist = processLookTurnDelta({
      rawGamepadLookX: 0,
      rawTouchLookXRadians: 0.04,
      keyboardTurnAxis: 0,
      turnSpeed: 2.4,
      deltaSeconds: 1 / 60,
      settings: { ...settings, aimAssist: 'off' },
      state: createLookFeelProcessorState(),
      aimTarget: target,
      playerAngle: 0,
      useGamepadAimAssist: false,
      useTouchAimAssist: true
    });
    expect(Math.abs(touchOnly.turnDeltaRadians)).not.toBeCloseTo(touchNoAssist.turnDeltaRadians, 4);
  });
});
