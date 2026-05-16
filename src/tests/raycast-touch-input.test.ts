import type Phaser from 'phaser';
import { describe, expect, it } from 'vitest';
import {
  collectRaycastTouchPressedActions,
  buildRaycastTouchButtonSpecs,
  buildRaycastTouchLayout,
  clampRaycastTouchLookDelta,
  clearRaycastTouchTransientState,
  computeRaycastTouchJoystickVector,
  isRaycastTouchPortrait,
  normalizeRaycastTouchAxis,
  normalizeRaycastTouchStick,
  shouldRaycastTouchCaptureBackgroundPointer,
  shouldShowRaycastTouchControls,
  RaycastTouchInput
} from '../game/systems/RaycastTouchInput';

type TouchButtonSpec = ReturnType<typeof buildRaycastTouchButtonSpecs>[number];

type TouchButtonHarness = {
  action: string;
  rect: {
    visible: boolean;
    setVisible: (value: boolean) => TouchButtonHarness['rect'];
    setAlpha: (value: number) => TouchButtonHarness['rect'];
    setFillStyle: (color: number, alpha?: number) => TouchButtonHarness['rect'];
    setStrokeStyle: (width: number, color: number, alpha?: number) => TouchButtonHarness['rect'];
  };
  label: {
    setVisible: (value: boolean) => TouchButtonHarness['label'];
    setAlpha: (value: number) => TouchButtonHarness['label'];
  };
  spec: TouchButtonSpec;
  active: boolean;
  pressed: boolean;
  pointerId: number | null;
};

type TouchHarness = {
  layout: ReturnType<typeof buildRaycastTouchLayout>;
  active: boolean;
  lastViewport: { width: number; height: number };
  buttons: Map<string, TouchButtonHarness>;
  queuedPressedActions: Set<string>;
  activePointers: Map<number, { kind: string; pointerId: number }>;
  processContactDown: (contact: { id: number; x: number; y: number; event?: Event }, event?: Event) => void;
  processContactMove: (contact: { id: number; x: number; y: number; event?: Event }, event?: Event) => void;
  processContactUp: (contact: { id: number; x: number; y: number; event?: Event }, event?: Event) => void;
};

function createDisplayObjectStub(text?: string) {
  const stub: {
    visible: boolean;
    text?: string;
    setOrigin: (x?: number, y?: number) => typeof stub;
    setDepth: (depth?: number) => typeof stub;
    setVisible: (value: boolean) => typeof stub;
    setAlpha: (value: number) => typeof stub;
    setFillStyle: (color: number, alpha?: number) => typeof stub;
    setStrokeStyle: (width: number, color: number, alpha?: number) => typeof stub;
    setPosition: (x: number, y: number) => typeof stub;
    destroy: () => void;
  } = {
    visible: true,
    text,
    setOrigin: () => stub,
    setDepth: () => stub,
    setVisible: (value: boolean) => {
      stub.visible = value;
      return stub;
    },
    setAlpha: () => stub,
    setFillStyle: () => stub,
    setStrokeStyle: () => stub,
    setPosition: () => stub,
    destroy: () => undefined
  };
  return stub;
}

function createTouchSceneStub(width = 1024, height = 768): Phaser.Scene {
  return {
    scale: { width, height },
    game: { canvas: { getBoundingClientRect: () => ({ left: 0, top: 0, width, height }) } },
    sound: {
      context: { state: 'running', resume: async () => undefined },
      unlock: () => undefined
    },
    input: {
      addPointer: () => undefined,
      on: () => undefined,
      off: () => undefined
    },
    add: {
      text: (_x: number, _y: number, text?: string) => createDisplayObjectStub(text),
      rectangle: () => createDisplayObjectStub(),
      circle: () => createDisplayObjectStub()
    }
  } as unknown as Phaser.Scene;
}

function createButtonHarness(
  spec: TouchButtonSpec,
  rectOverrides: Partial<TouchButtonHarness['rect']> = {}
): TouchButtonHarness {
  const rect = createDisplayObjectStub() as TouchButtonHarness['rect'] & { visible: boolean };
  const label = createDisplayObjectStub() as TouchButtonHarness['label'];
  rect.visible = true;
  return {
    action: spec.action,
    rect: Object.assign(rect, rectOverrides),
    label,
    spec,
    active: true,
    pressed: false,
    pointerId: null
  };
}

describe('raycast touch input', () => {
  it('normalizes joystick axes with a readable deadzone and capped magnitude', () => {
    expect(normalizeRaycastTouchAxis(0.12, 0.18)).toBe(0);
    expect(normalizeRaycastTouchAxis(-0.12, 0.18)).toBe(0);
    expect(normalizeRaycastTouchAxis(0.58, 0.18)).toBeCloseTo((0.58 - 0.18) / (1 - 0.18), 4);

    const stick = normalizeRaycastTouchStick(0.5, -0.75, 0.18);
    expect(stick.x).toBeGreaterThan(0);
    expect(stick.y).toBeLessThan(0);
  });

  it('clamps touch look deltas to prevent huge camera spikes', () => {
    expect(clampRaycastTouchLookDelta(99)).toBeLessThan(Math.PI * 0.33 + 0.0001);
    expect(clampRaycastTouchLookDelta(-99)).toBeGreaterThan(-(Math.PI * 0.33) - 0.0001);
  });

  it('returns proportional joystick vectors and resets cleanly at the center', () => {
    const halfPush = computeRaycastTouchJoystickVector(100, 100, 140, 100, 80, 0.18);
    const fullPush = computeRaycastTouchJoystickVector(100, 100, 220, 100, 80, 0.18);
    const centered = computeRaycastTouchJoystickVector(100, 100, 100, 100, 80, 0.18);

    expect(halfPush.x).toBeGreaterThan(0);
    expect(fullPush.x).toBeCloseTo(1, 3);
    expect(centered).toEqual({ x: 0, y: 0 });
  });

  it('builds a clean gameplay layout and ui layout for tablet use', () => {
    const landscape = buildRaycastTouchLayout(1024, 768, 1);
    const portrait = buildRaycastTouchLayout(768, 1024, 1.15);

    expect(landscape.portraitPrompt).toBe(false);
    expect(portrait.portraitPrompt).toBe(true);
    expect(landscape.buttonSize).toBeGreaterThan(0);
    expect(portrait.buttonSize).toBeGreaterThan(landscape.buttonSize * 0.9);
    expect(isRaycastTouchPortrait(768, 1024)).toBe(true);
  });

  it('exposes gameplay and ui button mappings for touch controls', () => {
    const layout = buildRaycastTouchLayout(1024, 768, 1);
    const gameplay = buildRaycastTouchButtonSpecs(layout, 'gameplay');
    const ui = buildRaycastTouchButtonSpecs(layout, 'ui');

    expect(gameplay.some((button) => button.action === 'fire')).toBe(true);
    expect(gameplay.some((button) => button.action === 'reload')).toBe(true);
    expect(gameplay.some((button) => button.action === 'pause')).toBe(true);
    expect(gameplay.some((button) => button.action === 'weapon1')).toBe(true);
    expect(gameplay.some((button) => button.action === 'previousWeapon')).toBe(true);
    expect(ui.some((button) => button.action === 'confirm')).toBe(true);
    expect(ui.some((button) => button.action === 'cancel')).toBe(true);
    expect(ui.some((button) => button.action === 'navUp')).toBe(true);
  });

  it('exposes ui mode without background capture so menu taps are not swallowed', () => {
    expect(shouldRaycastTouchCaptureBackgroundPointer('ui', false)).toBe(false);
    expect(buildRaycastTouchButtonSpecs(buildRaycastTouchLayout(1024, 768, 1), 'ui').length).toBeGreaterThan(0);
  });

  it('clears stuck move/fire state via transient reset helper', () => {
    const held = new Set(['fire' as const]);
    clearRaycastTouchTransientState({
      activePointers: new Map(),
      currentMove: { x: 1, y: 1 },
      currentLook: { x: 0.5, y: 0 },
      heldActions: held,
      pressedActions: new Set(['reload' as const])
    });
    expect(held.size).toBe(0);
  });

  it('only shows touch controls on touch-capable viewports when enabled', () => {
    expect(
      shouldShowRaycastTouchControls({ enabled: true, maxTouchPoints: 5, width: 1024, height: 768 })
    ).toBe(true);
    expect(
      shouldShowRaycastTouchControls({ enabled: true, maxTouchPoints: 0, width: 1024, height: 768 })
    ).toBe(false);
    expect(
      shouldShowRaycastTouchControls({ enabled: false, maxTouchPoints: 5, width: 1024, height: 768 })
    ).toBe(false);
  });

  it('collects pressed touch actions once per frame without losing queued taps', () => {
    const queue = new Set(['fire', 'reload'] as const);
    const collected = collectRaycastTouchPressedActions(queue);

    expect(collected.has('fire')).toBe(true);
    expect(collected.has('reload')).toBe(true);
    expect(queue.size).toBe(0);
  });

  it('tracks a touch button press as a one-shot pressed action', () => {
    const input = new RaycastTouchInput(createTouchSceneStub(), {
      hasTouchCapability: () => true,
      getViewport: () => ({ width: 1024, height: 768 }),
      getSettings: () => ({
        enabled: true,
        buttonScale: 1,
        lookSensitivity: 1,
        joystickDeadzone: 0.18
      })
    });
    const layout = buildRaycastTouchLayout(1024, 768, 1);
    const fireButtonSpec = buildRaycastTouchButtonSpecs(layout, 'gameplay').find((button) => button.action === 'fire');
    expect(fireButtonSpec).toBeDefined();

    const harness = input as unknown as TouchHarness;
    harness.layout = layout;
    harness.active = true;
    harness.lastViewport = { width: 1024, height: 768 };
    harness.buttons = new Map([
      [
        'fire',
        createButtonHarness(fireButtonSpec!, {
          setVisible: (value: boolean) => {
            const entry = harness.buttons.get('fire');
            if (entry) entry.rect.visible = value;
            return createDisplayObjectStub().setVisible(value) as TouchButtonHarness['rect'];
          }
        })
      ]
    ]);

    harness.processContactDown({ id: 11, x: fireButtonSpec!.x, y: fireButtonSpec!.y });

    expect(harness.queuedPressedActions.has('fire')).toBe(true);
    input.update();
    expect(input.consumePressed('fire')).toBe(true);
    expect(input.consumePressed('fire')).toBe(false);
    expect(harness.buttons.get('fire')?.pressed).toBe(true);
  });

  it('uses a fixed joystick base and resets to zero on release', () => {
    const input = new RaycastTouchInput(createTouchSceneStub(), {
      hasTouchCapability: () => true,
      getViewport: () => ({ width: 1024, height: 768 }),
      getSettings: () => ({
        enabled: true,
        buttonScale: 1,
        lookSensitivity: 1,
        joystickDeadzone: 0.18
      })
    });
    const layout = buildRaycastTouchLayout(1024, 768, 1);
    const harness = input as unknown as TouchHarness;
    harness.layout = layout;
    harness.active = true;
    harness.lastViewport = { width: 1024, height: 768 };

    harness.processContactDown({ id: 21, x: layout.joystickCenterX, y: layout.joystickCenterY });
    harness.processContactMove({ id: 21, x: layout.joystickCenterX + layout.joystickRadius * 0.5, y: layout.joystickCenterY });

    expect(input.getMoveInput().x).toBeGreaterThan(0);
    expect(input.getMoveInput().x).toBeLessThan(1);

    harness.processContactUp({ id: 21, x: layout.joystickCenterX, y: layout.joystickCenterY });
    expect(input.getMoveInput()).toEqual({ x: 0, y: 0 });
  });

  it('separates joystick, look and button multitouch contacts', () => {
    const input = new RaycastTouchInput(createTouchSceneStub(), {
      hasTouchCapability: () => true,
      getViewport: () => ({ width: 1024, height: 768 }),
      getSettings: () => ({
        enabled: true,
        buttonScale: 1,
        lookSensitivity: 1,
        joystickDeadzone: 0.18
      })
    });
    const layout = buildRaycastTouchLayout(1024, 768, 1);
    const fireButtonSpec = buildRaycastTouchButtonSpecs(layout, 'gameplay').find((button) => button.action === 'fire');
    expect(fireButtonSpec).toBeDefined();

    const harness = input as unknown as TouchHarness;
    harness.layout = layout;
    harness.active = true;
    harness.lastViewport = { width: 1024, height: 768 };
    harness.buttons = new Map([
      ['fire', createButtonHarness(fireButtonSpec!)]
    ]);

    harness.processContactDown({ id: 31, x: layout.joystickCenterX, y: layout.joystickCenterY });
    harness.processContactDown({ id: 32, x: layout.width * 0.82, y: layout.height * 0.45 });
    harness.processContactDown({ id: 33, x: fireButtonSpec!.x, y: fireButtonSpec!.y });

    expect(harness.activePointers.get(31)?.kind).toBe('joystick');
    expect(harness.activePointers.get(32)?.kind).toBe('look');
    expect(harness.activePointers.get(33)?.kind).toBe('button');
    expect(harness.queuedPressedActions.has('fire')).toBe(true);
    input.update();
    expect(input.consumePressed('fire')).toBe(true);
  });
});
