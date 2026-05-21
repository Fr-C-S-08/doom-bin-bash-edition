import { describe, expect, it } from 'vitest';
import { buildRaycastHudLayout } from '../game/raycast/RaycastHud';
import {
  buildRaycastPickupToastLayout,
  createRaycastPickupToastQueue,
  formatRaycastPickupToastMessage,
  getRaycastPickupToastColor,
  getRaycastPickupToastDisplay,
  mapRaycastHealthPickupToastKind,
  pushRaycastPickupToast,
  RAYCAST_PICKUP_TOAST_MAX_SLOTS
} from '../game/raycast/RaycastPickupToast';

describe('raycast pickup toast', () => {
  it('formats concise pickup messages in Spanish', () => {
    expect(formatRaycastPickupToastMessage('key')).toBe('FICHA RECUPERADA');
    expect(formatRaycastPickupToastMessage('secret')).toBe('SECRETO ENCONTRADO');
    expect(formatRaycastPickupToastMessage('health', { amount: 20 })).toBe('VIDA +20');
    expect(formatRaycastPickupToastMessage('ammo', { amount: 10 })).toBe('MUNICIÓN +10');
    expect(formatRaycastPickupToastMessage('powerup')).toBe('POWER-UP ACTIVADO');
  });

  it('assigns readable colors per pickup type', () => {
    expect(getRaycastPickupToastColor('key')).toBe('#ffe566');
    expect(getRaycastPickupToastColor('health')).toBe('#7dffb0');
    expect(getRaycastPickupToastColor('secret')).toBe('#d4a5ff');
    expect(getRaycastPickupToastColor('ammo')).toBe('#6be8ff');
    expect(getRaycastPickupToastColor('powerup')).toBe('#ffab5c');
  });

  it('places the toast below the health HUD block without overlapping the minimap corner', () => {
    const hud = buildRaycastHudLayout(1024, 768);
    const layout = buildRaycastPickupToastLayout(1024, hud);
    expect(layout.x).toBeCloseTo(512, 0);
    expect(layout.y).toBeGreaterThan(hud.healthBarY + hud.healthBarTrackHeight);
    expect(layout.y).toBeLessThan(hud.minimapFrameY);
  });

  it('keeps at most two queued pickup messages with newest first', () => {
    let queue = createRaycastPickupToastQueue(1400);
    queue = pushRaycastPickupToast(queue, { kind: 'key', nowMs: 1000 });
    queue = pushRaycastPickupToast(queue, { kind: 'secret', nowMs: 1100 });
    queue = pushRaycastPickupToast(queue, { kind: 'health', nowMs: 1200, amount: 15 });

    expect(queue.slots.length).toBe(RAYCAST_PICKUP_TOAST_MAX_SLOTS);
    expect(getRaycastPickupToastDisplay(queue, 1250)?.text).toBe('VIDA +15');
    expect(queue.slots[1]?.text).toBe('SECRETO ENCONTRADO');
    expect(queue.slots.filter(Boolean).length).toBe(2);
  });

  it('maps authored health pickups to health or powerup toasts', () => {
    expect(mapRaycastHealthPickupToastKind('health-pack')).toBe('health');
    expect(mapRaycastHealthPickupToastKind('repair-cell')).toBe('powerup');
  });
});
