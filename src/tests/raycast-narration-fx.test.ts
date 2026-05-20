import { describe, expect, it } from 'vitest';
import {
  buildRaycastNarrationFxState,
  computeNarrationGlitchOffsetX,
} from '../game/raycast/RaycastNarrationFx';

describe('RaycastNarrationFx', () => {
  it('computeNarrationGlitchOffsetX fades out after fade-in completes', () => {
    const active = {
      message: 'Señal',
      phase: 'fadeIn' as const,
      phaseStartedAtMs: 1_000,
      displayMs: 3_000,
    };
    expect(computeNarrationGlitchOffsetX(active, 1_000, 420)).not.toBe(0);
    expect(computeNarrationGlitchOffsetX(active, 1_500, 420)).toBe(0);
  });

  it('buildRaycastNarrationFxState exposes static bars and cursor during hold', () => {
    const fx = buildRaycastNarrationFxState(
      {
        message: 'Transmisión',
        phase: 'hold',
        phaseStartedAtMs: 2_000,
        displayMs: 4_000,
      },
      2_500,
      420,
      0.95,
    );
    expect(fx.staticHeights.length).toBe(5);
    expect(fx.showCursor).toBeTypeOf('boolean');
  });
});
