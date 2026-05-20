import { describe, expect, it } from 'vitest';
import {
  raycastHalfTan,
  raycastRayAngleFromCameraT,
  raycastScreenXFromAngleDelta,
} from '../game/raycast/RaycastProjection';
import {
  RAYCAST_BASE_FOV_DEGREES,
  RAYCAST_DEFAULT_FOV_SCALE,
  raycastFovDegreesFromScale,
  raycastFovRadiansFromScale,
} from '../game/raycast/RaycastRendererConfig';

describe('raycast projection', () => {
  it('expands default FOV by ~20% from classic base', () => {
    const baseDeg = RAYCAST_BASE_FOV_DEGREES;
    const defaultDeg = raycastFovDegreesFromScale(RAYCAST_DEFAULT_FOV_SCALE);
    expect(defaultDeg).toBeCloseTo(baseDeg * RAYCAST_DEFAULT_FOV_SCALE, 1);
    expect(defaultDeg).toBeGreaterThanOrEqual(129);
    expect(defaultDeg).toBeLessThanOrEqual(131);
  });

  it('maps center column to player forward and edges to ±half FOV (tangent)', () => {
    const fov = raycastFovRadiansFromScale(1.2);
    const halfTan = raycastHalfTan(fov);
    const playerAngle = 0.5;
    const center = raycastRayAngleFromCameraT(playerAngle, 0.5, halfTan);
    const left = raycastRayAngleFromCameraT(playerAngle, 0, halfTan);
    const right = raycastRayAngleFromCameraT(playerAngle, 1, halfTan);
    expect(center).toBeCloseTo(playerAngle, 5);
    expect(left).toBeCloseTo(playerAngle - fov * 0.5, 2);
    expect(right).toBeCloseTo(playerAngle + fov * 0.5, 2);
  });

  it('projects angle delta to screen X with tangent correction', () => {
    const fov = raycastFovRadiansFromScale(1.2);
    const halfTan = raycastHalfTan(fov);
    const width = 960;
    expect(raycastScreenXFromAngleDelta(0, halfTan, width)).toBeCloseTo(width * 0.5, 4);
    const edgeX = raycastScreenXFromAngleDelta(fov * 0.5, halfTan, width);
    expect(edgeX).toBeGreaterThan(width * 0.95);
  });
});
