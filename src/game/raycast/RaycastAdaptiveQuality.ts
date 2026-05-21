export interface RaycastAdaptiveQualityState {
  minimapStrideBoost: number;
}

export function createRaycastAdaptiveQualityState(): RaycastAdaptiveQualityState {
  return { minimapStrideBoost: 0 };
}

/**
 * When FPS drops 20+ below target, slow minimap redraws; restore when recovered.
 * Does not change render quality presets — runtime stride only.
 */
export function updateAdaptiveMinimapStrideBoost(
  state: RaycastAdaptiveQualityState,
  fps: number,
  fpsTarget: number,
): RaycastAdaptiveQualityState {
  if (fpsTarget <= 0 || fps <= 0) {
    return state.minimapStrideBoost === 0 ? state : { minimapStrideBoost: 0 };
  }

  const deficit = fpsTarget - fps;
  if (deficit >= 20) {
    return { minimapStrideBoost: 3 };
  }
  if (deficit >= 12) {
    return { minimapStrideBoost: 2 };
  }
  if (deficit <= 6 && state.minimapStrideBoost > 0) {
    return { minimapStrideBoost: Math.max(0, state.minimapStrideBoost - 1) };
  }
  return state;
}

export function getEffectiveMinimapStride(baseStride: number, boost: number): number {
  return Math.max(1, baseStride + boost);
}
