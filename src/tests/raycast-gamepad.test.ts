import { describe, expect, it } from 'vitest';
import {
  normalizeRaycastGamepadAxis,
  normalizeRaycastGamepadStick,
  readRaycastGamepadFrame,
  RaycastGamepadInput
} from '../game/systems/RaycastGamepadInput';

function makeButtons(pressedIndices: number[]): GamepadButton[] {
  return Array.from({ length: 16 }, (_, index) => ({
    pressed: pressedIndices.includes(index),
    touched: pressedIndices.includes(index),
    value: pressedIndices.includes(index) ? 1 : 0
  }));
}

function makePad(pressedIndices: number[] = [], axes: number[] = [0, 0, 0, 0], id = 'Xbox Controller'): Gamepad {
  return {
    id,
    index: 0,
    connected: true,
    mapping: 'standard',
    axes,
    buttons: makeButtons(pressedIndices) as unknown as Gamepad['buttons'],
    timestamp: 0
  } as unknown as Gamepad;
}

describe('raycast gamepad input', () => {
  it('applies deadzone scaling and preserves stick direction', () => {
    expect(normalizeRaycastGamepadAxis(0.1, 0.18)).toBe(0);
    expect(normalizeRaycastGamepadAxis(-0.1, 0.18)).toBe(0);
    expect(normalizeRaycastGamepadAxis(0.58, 0.18)).toBeCloseTo((0.58 - 0.18) / (1 - 0.18), 4);

    const stick = normalizeRaycastGamepadStick(0.5, -0.75, 0.18);
    expect(stick.x).toBeGreaterThan(0);
    expect(stick.y).toBeLessThan(0);
  });

  it('maps standard buttons and sticks into a readable frame', () => {
    const frame = readRaycastGamepadFrame(makePad([0, 7, 9], [0.42, -0.66, 0.25, 0.5]), {
      leftDeadzone: 0.18,
      rightDeadzone: 0.18,
      lookSensitivity: 1.15,
      invertLookY: false,
      vibrationEnabled: false
    });

    expect(frame.connected).toBe(true);
    expect(frame.label).toBe('Xbox Controller');
    expect(frame.heldActions.has('confirm')).toBe(true);
    expect(frame.heldActions.has('fire')).toBe(true);
    expect(frame.heldActions.has('pause')).toBe(true);
    expect(frame.move.x).toBeGreaterThan(0);
    expect(frame.move.y).toBeGreaterThan(0);
    expect(frame.look.x).toBeGreaterThan(0);
  });

  it('supports distinct movement/look deadzones and inverted look Y', () => {
    const frame = readRaycastGamepadFrame(makePad([], [0.22, -0.1, 0.32, -0.52]), {
      leftDeadzone: 0.2,
      rightDeadzone: 0.18,
      lookSensitivity: 1,
      invertLookY: true,
      vibrationEnabled: false
    });

    expect(frame.move.x).toBeGreaterThan(0);
    expect(frame.move.y).toBeCloseTo(0);
    expect(frame.look.x).toBeGreaterThan(0);
    expect(frame.look.y).toBeLessThan(0);
  });

  it('tracks pressed vs held transitions and falls back safely without a pad', () => {
    const pads: Array<ArrayLike<Gamepad | null>> = [
      [makePad([0])],
      [makePad([0])],
      [makePad([])],
      [makePad([0])]
    ];
    let index = 0;
    const input = new RaycastGamepadInput({
      getGamepads: () => pads[index++] ?? [],
      getSettings: () => ({
        leftDeadzone: 0.18,
        rightDeadzone: 0.18,
        lookSensitivity: 1,
        invertLookY: false,
        vibrationEnabled: false
      }),
      enableBrowserEvents: false,
      getNow: () => index * 100
    });

    input.update();
    expect(input.isConnected()).toBe(true);
    expect(input.consumeStatusMessage()).toBe('CONTROL DETECTADO');
    expect(input.consumePressed('confirm')).toBe(true);
    expect(input.consumePressed('confirm')).toBe(false);

    input.update();
    expect(input.consumePressed('confirm')).toBe(false);

    input.update();
    expect(input.isConnected()).toBe(true);
    expect(input.consumePressed('confirm')).toBe(false);

    input.update();
    expect(input.consumePressed('confirm')).toBe(true);
  });

  it('reports disconnected state cleanly when no pads are available', () => {
    const input = new RaycastGamepadInput({
      getGamepads: () => [],
      getSettings: () => ({
        leftDeadzone: 0.18,
        rightDeadzone: 0.18,
        lookSensitivity: 1,
        invertLookY: false,
        vibrationEnabled: false
      }),
      enableBrowserEvents: false
    });

    const frame = input.update();
    expect(frame.connected).toBe(false);
    expect(input.isConnected()).toBe(false);
    expect(input.getMoveInput()).toEqual({ x: 0, y: 0 });
    expect(input.getLookInput()).toEqual({ x: 0, y: 0 });
  });
});
