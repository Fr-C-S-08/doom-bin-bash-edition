import { describe, expect, it } from 'vitest';
import {
  createRaycastFrameStatsState,
  formatRaycastDebugHudExtras,
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
    const line = formatRaycastPerfHudLine(state, {
      frameMs: 40,
      renderMs: 28,
      enemies: 5,
      projectiles: 2,
      gmInFlight: true,
      fpsTarget: 60,
      renderQualityLabel: 'Balanceado',
      gmStatusLine: 'GM pending | voice off',
    });
    expect(line).toContain('GM pending | voice off');
    expect(line).toContain('FPS');
    expect(line).toContain('/ 60');
    expect(line).toContain('Q Balanceado');
  });

  it('formatRaycastDebugHudExtras includes fps target and gm status', () => {
    const line = formatRaycastDebugHudExtras({
      fpsCurrent: 118,
      fpsTarget: 120,
      renderQualityLabel: 'Rendimiento',
      gmStatusLine: 'GM idle | voice off | src ollama',
    });
    expect(line).toContain('FPS 118 / 120');
    expect(line).toContain('Q Rendimiento');
    expect(line).toContain('GM idle');
  });
});
