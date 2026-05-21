import { describe, expect, it } from 'vitest';
import { computeRaycastPausePanelLayout } from '../game/raycast/RaycastPausePanelLayout';

describe('RaycastPausePanelLayout', () => {
  it('centers panel within viewport with margins', () => {
    const layout = computeRaycastPausePanelLayout(960, 540);
    expect(layout.centerX).toBe(480);
    expect(layout.centerY).toBe(270);
    expect(layout.panelWidth).toBeLessThanOrEqual(660);
    expect(layout.panelHeight).toBeLessThanOrEqual(492);
    expect(layout.bodyWrapWidth).toBeGreaterThan(500);
  });
});
