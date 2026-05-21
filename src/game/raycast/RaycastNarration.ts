import type { GameMasterNarrationTier } from '../../services/gameMasterNarrationTypes';
import {
  buildRadioTransmissionLayout,
  isRadioTypewriterComplete,
  paginateRadioTransmissionText,
  sanitizeRadioDisplayText,
  type RadioTransmissionLayout,
} from './RaycastRadioTransmission';

export interface RaycastNarrationLayout extends RadioTransmissionLayout {
  /** @deprecated Prefer originX/originY — kept for tests. */
  centerX: number;
  centerY: number;
}

export interface RaycastNarrationOverlayConfig {
  displayMs?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  maxQueue?: number;
}

export interface RaycastNarrationPendingEntry {
  message: string;
  tier: GameMasterNarrationTier;
}

export interface RaycastNarrationQueueState {
  pending: RaycastNarrationPendingEntry[];
  active: RaycastNarrationActive | null;
  queueCooldownUntilMs: number;
}

export interface RaycastNarrationActive {
  message: string;
  pages: string[];
  pageIndex: number;
  tier: GameMasterNarrationTier;
  phase: 'fadeIn' | 'hold' | 'fadeOut';
  phaseStartedAtMs: number;
  displayMs: number;
  typewriterStartedAtMs: number;
}

export const RAYCAST_NARRATION_DEFAULT_DISPLAY_MS = 5_200;
export const RAYCAST_NARRATION_FADE_IN_MS = 420;
export const RAYCAST_NARRATION_FADE_OUT_MS = 500;
export const RAYCAST_NARRATION_QUEUE_GAP_MS = 450;
export const RAYCAST_NARRATION_MAX_QUEUE = 6;

const MOCK_NARRATION_LINES: readonly string[] = [
  'Canal táctico abierto. El búnker registra tu avance—no bajes el arma.',
  'Interferencia en la banda. Algo respira detrás del muro oxidado.',
  'Señal militar débil: puerta sellada al norte. Llave pendiente.',
  'Comms: presión hostil en aumento. El director marca zona caliente.',
  'Radio fantasma: "no confíes en el silencio". Sigue el objetivo.',
  'Transmisión corta—el corredor tiembla. Avanza antes de que cierre.',
];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function buildRaycastNarrationLayout(width: number, height: number): RaycastNarrationLayout {
  const compact = width <= 960 || height <= 540;
  const panelWidth = Math.min(248, Math.max(196, Math.round(width * 0.26)));
  const panelHeight = 68;
  const originX = 24;
  const minimapStack = compact ? 150 : 184;
  const originY = 24 + minimapStack + 10;
  return {
    originX,
    originY,
    panelWidth,
    panelHeight,
    bodyWrapWidth: panelWidth - 14,
    liveIndicatorX: originX + panelWidth - 6,
    liveIndicatorY: originY + 4,
    centerX: originX + panelWidth * 0.5,
    centerY: originY + panelHeight * 0.5,
  };
}

export function buildRaycastNarrationLayoutFromHud(
  hud: Parameters<typeof buildRadioTransmissionLayout>[0],
): RaycastNarrationLayout {
  const radio = buildRadioTransmissionLayout(hud);
  return {
    ...radio,
    centerX: radio.originX + radio.panelWidth * 0.5,
    centerY: radio.originY + radio.panelHeight * 0.5,
  };
}

export function normalizeNarrationMessage(message: string): string {
  return message.replace(/\s+/g, ' ').trim();
}

export function pickRaycastNarrationMockLine(seed = Date.now()): string {
  const index = Math.abs(seed) % MOCK_NARRATION_LINES.length;
  return MOCK_NARRATION_LINES[index] ?? MOCK_NARRATION_LINES[0];
}

export function createRaycastNarrationQueueState(): RaycastNarrationQueueState {
  return { pending: [], active: null, queueCooldownUntilMs: 0 };
}

export function enqueueNarrationMessage(
  state: RaycastNarrationQueueState,
  message: string,
  maxQueue = RAYCAST_NARRATION_MAX_QUEUE,
  nowMs = 0,
  displayMs = RAYCAST_NARRATION_DEFAULT_DISPLAY_MS,
  tier: GameMasterNarrationTier = 'ambient',
): RaycastNarrationQueueState {
  const normalized = normalizeNarrationMessage(message);
  if (!normalized) return state;

  const entry: RaycastNarrationPendingEntry = { message: normalized, tier };

  if (!state.active) {
    return {
      ...state,
      active: startNarrationActive(normalized, nowMs, displayMs, tier),
    };
  }

  if (tier === 'critical') {
    return {
      pending: [],
      active: startNarrationActive(normalized, nowMs, displayMs, tier),
      queueCooldownUntilMs: 0,
    };
  }

  if (tier === 'important' && state.active.tier === 'ambient') {
    const pending = mergeNarrationPending(state.pending, entry, maxQueue);
    return {
      pending,
      active: startNarrationActive(normalized, nowMs, displayMs, tier),
      queueCooldownUntilMs: 0,
    };
  }

  const pending = mergeNarrationPending(state.pending, entry, maxQueue);
  return { ...state, pending };
}

function mergeNarrationPending(
  pending: RaycastNarrationPendingEntry[],
  entry: RaycastNarrationPendingEntry,
  maxQueue: number,
): RaycastNarrationPendingEntry[] {
  const withoutAmbient =
    entry.tier === 'important' ? pending.filter((p) => p.tier !== 'ambient') : pending;
  return [...withoutAmbient, entry].slice(-maxQueue);
}

function startNarrationActive(
  message: string,
  nowMs: number,
  displayMs: number,
  tier: GameMasterNarrationTier,
): RaycastNarrationActive {
  const pages = paginateRadioTransmissionText(message);
  return {
    message,
    pages: pages.length > 0 ? pages : [message],
    pageIndex: 0,
    tier,
    phase: 'fadeIn',
    phaseStartedAtMs: nowMs,
    typewriterStartedAtMs: nowMs,
    displayMs: Math.max(1_800, Math.min(9_000, displayMs)),
  };
}

export function isNarrationEntryComplete(
  active: RaycastNarrationActive,
  nowMs: number,
  config: Required<RaycastNarrationOverlayConfig>,
): boolean {
  if (active.phase !== 'fadeOut') return false;
  const elapsed = Math.max(0, nowMs - active.phaseStartedAtMs);
  return elapsed >= config.fadeOutMs;
}

export function advanceNarrationQueue(
  state: RaycastNarrationQueueState,
  nowMs: number,
  config: Required<RaycastNarrationOverlayConfig>,
): RaycastNarrationQueueState {
  if (state.active) {
    if (!isNarrationEntryComplete(state.active, nowMs, config)) {
      return state;
    }
    const pending = [...state.pending];
    if (pending.length === 0) {
      return { pending: [], active: null, queueCooldownUntilMs: 0 };
    }
    return {
      pending,
      active: null,
      queueCooldownUntilMs: nowMs + RAYCAST_NARRATION_QUEUE_GAP_MS,
    };
  }

  if (state.pending.length === 0 || nowMs < state.queueCooldownUntilMs) {
    return state;
  }

  const pending = [...state.pending];
  const nextEntry = pickNextNarrationPending(pending);
  if (!nextEntry) {
    return { pending: [], active: null, queueCooldownUntilMs: 0 };
  }

  const remaining = pending.filter((entry) => entry !== nextEntry);

  return {
    pending: remaining,
    active: startNarrationActive(nextEntry.message, nowMs, config.displayMs, nextEntry.tier),
    queueCooldownUntilMs: 0,
  };
}

function pickNextNarrationPending(
  pending: RaycastNarrationPendingEntry[],
): RaycastNarrationPendingEntry | null {
  if (pending.length === 0) return null;
  const critical = pending.find((entry) => entry.tier === 'critical');
  if (critical) return critical;
  const important = pending.find((entry) => entry.tier === 'important');
  if (important) return important;
  return pending[pending.length - 1] ?? null;
}

export function computeNarrationOverlayAlpha(
  active: RaycastNarrationActive,
  nowMs: number,
  config: Required<RaycastNarrationOverlayConfig>,
): number {
  const elapsed = Math.max(0, nowMs - active.phaseStartedAtMs);

  if (active.phase === 'fadeIn') {
    if (elapsed >= config.fadeInMs) return 1;
    return clamp01(elapsed / config.fadeInMs);
  }

  if (active.phase === 'hold') {
    if (elapsed >= active.displayMs) return -1;
    const settle = clamp01(elapsed / 220);
    const pulse = 0.92 + Math.sin(nowMs * 0.007) * 0.05;
    return clamp01(pulse * (0.88 + settle * 0.12));
  }

  if (elapsed >= config.fadeOutMs) return -1;
  return clamp01(1 - elapsed / config.fadeOutMs);
}

export function tickNarrationTypewriterPages(
  active: RaycastNarrationActive,
  nowMs: number,
): RaycastNarrationActive {
  const pageText = active.pages[active.pageIndex] ?? active.message;
  const displayPage = sanitizeRadioDisplayText(pageText);
  if (!isRadioTypewriterComplete(displayPage, active.typewriterStartedAtMs, nowMs)) {
    return active;
  }
  if (active.pageIndex >= active.pages.length - 1) return active;
  return {
    ...active,
    pageIndex: active.pageIndex + 1,
    typewriterStartedAtMs: nowMs,
  };
}

export function tickNarrationPhase(
  active: RaycastNarrationActive,
  nowMs: number,
  config: Required<RaycastNarrationOverlayConfig>,
): RaycastNarrationActive {
  const next = tickNarrationTypewriterPages(active, nowMs);
  const elapsed = Math.max(0, nowMs - next.phaseStartedAtMs);
  const onLastPage = next.pageIndex >= next.pages.length - 1;
  const pageText = sanitizeRadioDisplayText(next.pages[next.pageIndex] ?? next.message);
  const typedDone = isRadioTypewriterComplete(pageText, next.typewriterStartedAtMs, nowMs);

  if (next.phase === 'fadeIn' && elapsed >= config.fadeInMs) {
    return { ...next, phase: 'hold', phaseStartedAtMs: nowMs };
  }

  if (next.phase === 'hold' && typedDone && onLastPage && elapsed >= next.displayMs) {
    return { ...next, phase: 'fadeOut', phaseStartedAtMs: nowMs };
  }

  return next;
}
