import type Phaser from 'phaser';

export const FPS_TARGET_OPTIONS = [60, 90, 120, 0] as const;
export type FpsTarget = (typeof FPS_TARGET_OPTIONS)[number];

export const RENDER_QUALITY_OPTIONS = ['performance', 'balanced', 'quality'] as const;
export type RenderQualityId = (typeof RENDER_QUALITY_OPTIONS)[number];

export const DEFAULT_FPS_TARGET: FpsTarget = 60;
export const DEFAULT_RENDER_QUALITY: RenderQualityId = 'balanced';

export function normalizeFpsTarget(value: unknown): FpsTarget {
  const n = Number(value);
  if (n === 90 || n === 120) return n;
  if (n === 0) return 0;
  return 60;
}

export function normalizeRenderQuality(value: unknown): RenderQualityId {
  if (value === 'performance' || value === 'quality') return value;
  return 'balanced';
}

export function formatFpsTargetLabel(target: FpsTarget): string {
  return target === 0 ? 'Sin límite' : `${target} (objetivo)`;
}

export function formatRenderQualityLabel(quality: RenderQualityId): string {
  if (quality === 'performance') return 'Rendimiento';
  if (quality === 'quality') return 'Calidad';
  return 'Balanceado';
}

export function cycleFpsTarget(current: FpsTarget, direction: number): FpsTarget {
  const idx = FPS_TARGET_OPTIONS.indexOf(current);
  const base = idx >= 0 ? idx : 0;
  const next = (base + direction + FPS_TARGET_OPTIONS.length) % FPS_TARGET_OPTIONS.length;
  return FPS_TARGET_OPTIONS[next] ?? DEFAULT_FPS_TARGET;
}

export function cycleRenderQuality(current: RenderQualityId, direction: number): RenderQualityId {
  const idx = RENDER_QUALITY_OPTIONS.indexOf(current);
  const base = idx >= 0 ? idx : 1;
  const next = (base + direction + RENDER_QUALITY_OPTIONS.length) % RENDER_QUALITY_OPTIONS.length;
  return RENDER_QUALITY_OPTIONS[next] ?? DEFAULT_RENDER_QUALITY;
}

/** Minimap refresh stride while playing (higher = less often). */
export function getMinimapStrideForRenderQuality(quality: RenderQualityId): number {
  if (quality === 'performance') return 5;
  if (quality === 'quality') return 2;
  return 3;
}

export function applyFpsTargetToGame(game: Phaser.Game, target: FpsTarget): void {
  const loop = game.loop as { targetFps?: number; fpsLimit?: number };
  const limit = target === 0 ? 0 : target;
  if (typeof loop.targetFps === 'number') {
    loop.targetFps = limit;
  } else if (typeof loop.fpsLimit === 'number') {
    loop.fpsLimit = limit;
  }
}
