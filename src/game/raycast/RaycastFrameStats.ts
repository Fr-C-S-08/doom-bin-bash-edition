export interface RaycastFrameStatsSample {
  frameMs: number;
  renderMs: number;
  enemies: number;
  projectiles: number;
  gmInFlight: boolean;
}

export interface RaycastFrameStatsState {
  fps: number;
  avgFrameMs: number;
  maxFrameMs: number;
  avgRenderMs: number;
  maxRenderMs: number;
  sampleCount: number;
}

const EMA_ALPHA = 0.08;

export function createRaycastFrameStatsState(): RaycastFrameStatsState {
  return {
    fps: 0,
    avgFrameMs: 0,
    maxFrameMs: 0,
    avgRenderMs: 0,
    maxRenderMs: 0,
    sampleCount: 0,
  };
}

export function recordRaycastFrameSample(
  state: RaycastFrameStatsState,
  sample: RaycastFrameStatsSample,
): RaycastFrameStatsState {
  const frameMs = Math.max(0, sample.frameMs);
  const renderMs = Math.max(0, sample.renderMs);
  const next: RaycastFrameStatsState = {
    ...state,
    sampleCount: state.sampleCount + 1,
    maxFrameMs: Math.max(state.maxFrameMs, frameMs),
    maxRenderMs: Math.max(state.maxRenderMs, renderMs),
    avgFrameMs: state.sampleCount === 0 ? frameMs : state.avgFrameMs * (1 - EMA_ALPHA) + frameMs * EMA_ALPHA,
    avgRenderMs: state.sampleCount === 0 ? renderMs : state.avgRenderMs * (1 - EMA_ALPHA) + renderMs * EMA_ALPHA,
    fps: frameMs > 0 ? 1000 / frameMs : 0,
  };
  return next;
}

export function formatRaycastPerfHudLine(
  state: RaycastFrameStatsState,
  sample: RaycastFrameStatsSample,
): string {
  const fps = state.fps > 0 ? state.fps.toFixed(0) : '—';
  const frameNow = sample.frameMs.toFixed(1);
  const frameAvg = state.avgFrameMs.toFixed(1);
  const frameMax = state.maxFrameMs.toFixed(1);
  const renderNow = sample.renderMs.toFixed(1);
  const renderAvg = state.avgRenderMs.toFixed(1);
  const gm = sample.gmInFlight ? 'GM pending' : 'GM idle';
  return [
    `PERF  FPS ${fps}  frame ${frameNow}ms (avg ${frameAvg} max ${frameMax})`,
    `render ${renderNow}ms (avg ${renderAvg} max ${state.maxRenderMs.toFixed(1)})`,
    `ents ${sample.enemies}  proj ${sample.projectiles}  ${gm}`,
  ].join('\n');
}
