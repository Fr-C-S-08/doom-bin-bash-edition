export interface RaycastRendererConfig {
  fovRadians: number;
  rayCount: number;
  maxWallHeight: number;
}

/** Classic raycast horizontal FOV at scale 1.0 (pre–game-feel pass). */
export const RAYCAST_BASE_FOV_DEGREES = 108.24;

/** Default +20% wider view; same ray count — slightly lower angular resolution per column. */
export const RAYCAST_DEFAULT_FOV_SCALE = 1.2;

export const RAYCAST_FOV_SCALE_MIN = 1;
export const RAYCAST_FOV_SCALE_MAX = 1.25;

export const RAYCAST_FOV_SCALE_STEPS = [1, 1.1, 1.2, 1.25] as const;

export type RaycastFovScaleStep = (typeof RAYCAST_FOV_SCALE_STEPS)[number];

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function raycastBaseFovRadians(): number {
  return (RAYCAST_BASE_FOV_DEGREES * Math.PI) / 180;
}

export function raycastFovRadiansFromScale(fovScale: number): number {
  const scale = clamp(fovScale, RAYCAST_FOV_SCALE_MIN, RAYCAST_FOV_SCALE_MAX);
  return raycastBaseFovRadians() * scale;
}

export function raycastFovDegreesFromScale(fovScale: number): number {
  return (raycastFovRadiansFromScale(fovScale) * 180) / Math.PI;
}

export function buildRaycastRendererConfig(
  fovScale: number = RAYCAST_DEFAULT_FOV_SCALE,
): RaycastRendererConfig {
  return {
    fovRadians: raycastFovRadiansFromScale(fovScale),
    rayCount: 640,
    maxWallHeight: 620,
  };
}

/** Base config at scale 1.0 — tests and legacy references. */
export const RAYCAST_RENDERER_CONFIG: RaycastRendererConfig = buildRaycastRendererConfig(1);
