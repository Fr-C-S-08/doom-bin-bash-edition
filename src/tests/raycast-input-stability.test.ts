import { describe, expect, it } from 'vitest';
import {
  RAYCAST_GAMEPAD_COMBAT_ACTIONS,
  shouldAllowRaycastCombatGamepadInput
} from '../game/systems/RaycastGamepadInput';
import {
  clearRaycastTouchTransientState,
  shouldRaycastTouchCaptureBackgroundPointer,
  shouldRaycastTouchPreventDefault,
  type RaycastTouchAction
} from '../game/systems/RaycastTouchInput';

function stepBinaryMenuSelection(current: number, direction: 'up' | 'down', optionCount = 2): number {
  if (direction === 'up') return (current + optionCount - 1) % optionCount;
  return (current + 1) % optionCount;
}

describe('raycast input stability', () => {
  it('clears touch pointers, movement, look, and button queues on reset', () => {
    const activePointers = new Map([
      [
        1,
        {
          kind: 'joystick' as const,
          pointerId: 1,
          originX: 0,
          originY: 0,
          lastX: 0,
          lastY: 0
        }
      ]
    ]);
    const heldActions = new Set<RaycastTouchAction>(['fire', 'reload']);
    const pressedActions = new Set<RaycastTouchAction>(['pause']);
    const buttons = [{ pressed: true, pointerId: 1 }];

    clearRaycastTouchTransientState({
      activePointers,
      currentMove: { x: 0.8, y: -0.4 },
      currentLook: { x: 0.2, y: 0.1 },
      heldActions,
      pressedActions,
      buttons
    });

    expect(activePointers.size).toBe(0);
    expect(heldActions.size).toBe(0);
    expect(pressedActions.size).toBe(0);
    expect(buttons[0].pressed).toBe(false);
    expect(buttons[0].pointerId).toBeNull();
  });

  it('only prevents default for gameplay capture or overlay buttons', () => {
    expect(shouldRaycastTouchPreventDefault('ui', false)).toBe(false);
    expect(shouldRaycastTouchPreventDefault('ui', true)).toBe(false);
    expect(shouldRaycastTouchPreventDefault('gameplay', false)).toBe(false);
    expect(shouldRaycastTouchPreventDefault('gameplay', true)).toBe(true);
  });

  it('does not capture background touches in ui/menu mode', () => {
    expect(shouldRaycastTouchCaptureBackgroundPointer('ui', false)).toBe(false);
    expect(shouldRaycastTouchCaptureBackgroundPointer('ui', true)).toBe(true);
    expect(shouldRaycastTouchCaptureBackgroundPointer('gameplay', false)).toBe(true);
  });

  it('blocks combat gamepad actions while paused', () => {
    expect(shouldAllowRaycastCombatGamepadInput(true)).toBe(false);
    expect(shouldAllowRaycastCombatGamepadInput(false)).toBe(true);
    expect(RAYCAST_GAMEPAD_COMBAT_ACTIONS).toEqual(['reload', 'fire', 'nextWeapon', 'previousWeapon']);
  });

  it('moves binary menu selection up and down independently', () => {
    expect(stepBinaryMenuSelection(0, 'down')).toBe(1);
    expect(stepBinaryMenuSelection(1, 'down')).toBe(0);
    expect(stepBinaryMenuSelection(0, 'up')).toBe(1);
    expect(stepBinaryMenuSelection(1, 'up')).toBe(0);
  });
});
