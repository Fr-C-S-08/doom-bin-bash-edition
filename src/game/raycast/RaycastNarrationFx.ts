import type { RaycastNarrationActive } from './RaycastNarration';

export interface RaycastNarrationFxState {
  glitchOffsetX: number;
  flickerMul: number;
  staticHeights: number[];
  showCursor: boolean;
}

const STATIC_BAR_COUNT = 5;

function hashNoise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export function computeNarrationGlitchOffsetX(
  active: RaycastNarrationActive,
  nowMs: number,
  fadeInMs: number,
): number {
  if (active.phase !== 'fadeIn') return 0;
  const elapsed = Math.max(0, nowMs - active.phaseStartedAtMs);
  if (elapsed >= fadeInMs) return 0;
  const t = elapsed / Math.max(1, fadeInMs);
  const spike = hashNoise(nowMs * 0.037 + active.message.length) > 0.62 ? 2.5 : 1;
  return Math.sin(nowMs * 0.08) * spike * (1 - t);
}

export function computeNarrationFlickerMul(nowMs: number, alpha: number): number {
  if (alpha <= 0.05) return 1;
  const bucket = Math.floor(nowMs / 48) % 9;
  if (bucket === 0 || bucket === 4) return 0.86;
  if (bucket === 2) return 0.94;
  return 1;
}

export function computeNarrationStaticHeights(nowMs: number): number[] {
  const heights: number[] = [];
  for (let i = 0; i < STATIC_BAR_COUNT; i += 1) {
    const n = hashNoise(nowMs * 0.011 + i * 1.7);
    heights.push(0.15 + n * 0.85);
  }
  return heights;
}

export function shouldShowNarrationCursor(
  active: RaycastNarrationActive,
  nowMs: number,
): boolean {
  if (active.phase !== 'hold') return false;
  return Math.floor(nowMs / 420) % 2 === 0;
}

export function buildRaycastNarrationFxState(
  active: RaycastNarrationActive,
  nowMs: number,
  fadeInMs: number,
  alpha: number,
): RaycastNarrationFxState {
  return {
    glitchOffsetX: computeNarrationGlitchOffsetX(active, nowMs, fadeInMs),
    flickerMul: computeNarrationFlickerMul(nowMs, alpha),
    staticHeights: computeNarrationStaticHeights(nowMs),
    showCursor: shouldShowNarrationCursor(active, nowMs),
  };
}
