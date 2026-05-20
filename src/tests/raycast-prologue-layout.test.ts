import { describe, expect, it } from 'vitest';
import {
  computePrologueScreenLayout,
  PROLOGUE_SAFE_MARGIN_PX,
} from '../game/raycast/RaycastPrologueLayout';

describe('raycast prologue layout', () => {
  it('keeps columns inside safe margins at 1440x900', () => {
    const layout = computePrologueScreenLayout(1440, 900);
    expect(layout.missionX).toBeGreaterThanOrEqual(PROLOGUE_SAFE_MARGIN_PX);
    expect(layout.controlsX).toBeLessThanOrEqual(1440 - PROLOGUE_SAFE_MARGIN_PX);
    expect(layout.missionX).toBeLessThan(layout.controlsX);
    expect(layout.twoColumn).toBe(true);
  });

  it('uses vertical stack on narrow viewports', () => {
    const layout = computePrologueScreenLayout(720, 560);
    expect(layout.twoColumn).toBe(false);
    expect(layout.missionX).toBe(layout.centerX);
    expect(layout.controlsX).toBe(layout.centerX);
  });
});
