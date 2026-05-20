import { describe, expect, it } from 'vitest';
import {
  createRaycastFrameStatsState,
  formatRaycastPerfHudLine,
  recordRaycastFrameSample,
} from '../game/raycast/RaycastFrameStats';

describe('RaycastFrameStats', () => {
  it('recordRaycastFrameSample tracks avg and max frame times', () => {
    let state = createRaycastFrameStatsState();
    state = recordRaycastFrameSample(state, {
      frameMs: 20,
      renderMs: 12,
      enemies: 3,
      projectiles: 1,
      gmInFlight: false,
    });
    state = recordRaycastFrameSample(state, {
      frameMs: 40,
      renderMs: 28,
      enemies: 5,
      projectiles: 2,
      gmInFlight: true,
    });

    expect(state.maxFrameMs).toBe(40);
    expect(state.maxRenderMs).toBe(28);
    expect(state.avgFrameMs).toBeGreaterThan(0);
    expect(formatRaycastPerfHudLine(state, {
      frameMs: 40,
      renderMs: 28,
      enemies: 5,
      projectiles: 2,
      gmInFlight: true,
    })).toContain('GM pending');
  });
});
