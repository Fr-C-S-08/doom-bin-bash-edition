import { describe, expect, it } from 'vitest';
import {
  cycleFpsTarget,
  formatFpsTargetLabel,
  getMinimapStrideForRenderQuality,
  normalizeFpsTarget,
  normalizeRenderQuality,
} from '../game/raycast/RaycastPerformanceSettings';

describe('RaycastPerformanceSettings', () => {
  it('normalizes fps target and render quality', () => {
    expect(normalizeFpsTarget(120)).toBe(120);
    expect(normalizeFpsTarget(0)).toBe(0);
    expect(normalizeFpsTarget('bad')).toBe(60);
    expect(normalizeRenderQuality('performance')).toBe('performance');
    expect(normalizeRenderQuality('x')).toBe('balanced');
  });

  it('cycles fps target through options', () => {
    expect(cycleFpsTarget(60, 1)).toBe(90);
    expect(cycleFpsTarget(120, 1)).toBe(0);
    expect(formatFpsTargetLabel(0)).toBe('Sin límite');
  });

  it('maps render quality to minimap stride', () => {
    expect(getMinimapStrideForRenderQuality('performance')).toBeGreaterThan(
      getMinimapStrideForRenderQuality('quality'),
    );
  });
});
