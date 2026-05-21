import { describe, expect, it } from 'vitest';
import {
  createRaycastAdaptiveQualityState,
  getEffectiveMinimapStride,
  updateAdaptiveMinimapStrideBoost,
} from '../game/raycast/RaycastAdaptiveQuality';

describe('raycast adaptive quality', () => {
  it('boosts minimap stride when FPS is well below target', () => {
    const next = updateAdaptiveMinimapStrideBoost(createRaycastAdaptiveQualityState(), 88, 120);
    expect(next.minimapStrideBoost).toBeGreaterThanOrEqual(2);
    expect(getEffectiveMinimapStride(3, next.minimapStrideBoost)).toBeGreaterThan(3);
  });

  it('restores stride boost when FPS recovers', () => {
    let state = updateAdaptiveMinimapStrideBoost(createRaycastAdaptiveQualityState(), 80, 120);
    expect(state.minimapStrideBoost).toBeGreaterThan(0);
    state = updateAdaptiveMinimapStrideBoost(state, 118, 120);
    expect(state.minimapStrideBoost).toBeLessThan(3);
  });
});
