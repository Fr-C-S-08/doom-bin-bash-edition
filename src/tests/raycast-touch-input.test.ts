import { describe, expect, it } from 'vitest';
import {
  buildRaycastTouchButtonSpecs,
  buildRaycastTouchLayout,
  clampRaycastTouchLookDelta,
  isRaycastTouchPortrait,
  normalizeRaycastTouchAxis,
  normalizeRaycastTouchStick,
  shouldShowRaycastTouchControls
} from '../game/systems/RaycastTouchInput';

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
});
