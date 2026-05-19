import type { RaycastHudLayout } from './RaycastHud';

export type RaycastPickupToastKind = 'key' | 'secret' | 'health' | 'ammo' | 'powerup';

export interface RaycastPickupToastLayout {
  x: number;
  y: number;
  maxWidth: number;
}

export interface RaycastPickupToastEntry {
  text: string;
  color: string;
  expiresAtMs: number;
}

export interface RaycastPickupToastQueueState {
  slots: Array<RaycastPickupToastEntry | null>;
  holdMs: number;
}

export const RAYCAST_PICKUP_TOAST_DEFAULT_HOLD_MS = 1500;
export const RAYCAST_PICKUP_TOAST_MAX_SLOTS = 2;
export const RAYCAST_PICKUP_TOAST_FADE_MS = 180;

const PICKUP_COLORS: Record<RaycastPickupToastKind, string> = {
  key: '#ffe566',
  secret: '#d4a5ff',
  health: '#7dffb0',
  ammo: '#6be8ff',
  powerup: '#ffab5c'
};

export function buildRaycastPickupToastLayout(width: number, hud: Pick<RaycastHudLayout, 'healthBarY' | 'healthBarTrackHeight'>): RaycastPickupToastLayout {
  return {
    x: width * 0.5,
    y: hud.healthBarY + hud.healthBarTrackHeight + 22,
    maxWidth: Math.max(220, Math.round(width * 0.42))
  };
}

export function getRaycastPickupToastColor(kind: RaycastPickupToastKind): string {
  return PICKUP_COLORS[kind];
}

export function formatRaycastPickupToastMessage(
  kind: RaycastPickupToastKind,
  details?: { amount?: number; label?: string }
): string {
  const amount = details?.amount !== undefined ? Math.max(0, Math.floor(details.amount)) : null;
  switch (kind) {
    case 'key':
      return 'FICHA RECUPERADA';
    case 'secret':
      return 'SECRETO ENCONTRADO';
    case 'health':
      return amount !== null && amount > 0 ? `VIDA +${amount}` : 'VIDA RECUPERADA';
    case 'ammo':
      return amount !== null && amount > 0 ? `MUNICIÓN +${amount}` : 'MUNICIÓN RECUPERADA';
    case 'powerup':
      return details?.label?.trim() ? details.label.trim().toUpperCase() : 'POWER-UP ACTIVADO';
    default:
      return 'OBJETO RECOGIDO';
  }
}

export function createRaycastPickupToastQueue(holdMs = RAYCAST_PICKUP_TOAST_DEFAULT_HOLD_MS): RaycastPickupToastQueueState {
  return {
    slots: Array.from({ length: RAYCAST_PICKUP_TOAST_MAX_SLOTS }, () => null),
    holdMs: Math.max(900, Math.min(2200, holdMs))
  };
}

/** Push a toast; newest replaces the active slot, previous active shifts into the second slot. */
export function pushRaycastPickupToast(
  state: RaycastPickupToastQueueState,
  input: { kind: RaycastPickupToastKind; nowMs: number; amount?: number; label?: string }
): RaycastPickupToastQueueState {
  const entry: RaycastPickupToastEntry = {
    text: formatRaycastPickupToastMessage(input.kind, { amount: input.amount, label: input.label }),
    color: getRaycastPickupToastColor(input.kind),
    expiresAtMs: input.nowMs + state.holdMs
  };
  const nextSlots: Array<RaycastPickupToastEntry | null> = [entry, state.slots[0]];
  while (nextSlots.length < RAYCAST_PICKUP_TOAST_MAX_SLOTS) nextSlots.push(null);
  return {
    ...state,
    slots: nextSlots.slice(0, RAYCAST_PICKUP_TOAST_MAX_SLOTS)
  };
}

export function pruneRaycastPickupToastQueue(state: RaycastPickupToastQueueState, nowMs: number): RaycastPickupToastQueueState {
  const slots = state.slots.map((slot) => (slot && slot.expiresAtMs > nowMs ? slot : null));
  if (slots.every((slot, index) => slot === state.slots[index])) return state;
  return { ...state, slots };
}

export function getRaycastPickupToastDisplay(state: RaycastPickupToastQueueState, nowMs: number): RaycastPickupToastEntry | null {
  const pruned = pruneRaycastPickupToastQueue(state, nowMs);
  return pruned.slots.find((slot) => slot !== null) ?? null;
}

export function mapRaycastHealthPickupToastKind(kind: 'health-pack' | 'repair-cell'): RaycastPickupToastKind {
  return kind === 'repair-cell' ? 'powerup' : 'health';
}
