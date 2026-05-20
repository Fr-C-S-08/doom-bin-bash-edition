/** Shared raycast camera projection — tangent-correct FOV reduces wide-angle stretch. */

export function raycastHalfTan(fovRadians: number): number {
  return Math.tan(Math.max(0.01, fovRadians) * 0.5);
}

/** Map screen column t ∈ [0,1] to world ray angle (tangent-correct pinhole). */
export function raycastRayAngleFromCameraT(
  playerAngle: number,
  cameraT: number,
  halfTan: number,
): number {
  const rel = cameraT * 2 - 1;
  return playerAngle + Math.atan(halfTan * rel);
}

/** Map angular offset from view center to horizontal screen coordinate. */
export function raycastScreenXFromAngleDelta(
  angleDelta: number,
  halfTan: number,
  width: number,
): number {
  if (halfTan <= 1e-6) return width * 0.5;
  return width * 0.5 + (Math.tan(angleDelta) / halfTan) * width * 0.5;
}
