export interface RaycastNarrationLayout {
  centerX: number;
  centerY: number;
  panelWidth: number;
  panelHeight: number;
  bodyWrapWidth: number;
}

export interface RaycastNarrationOverlayConfig {
  displayMs?: number;
  fadeInMs?: number;
  fadeOutMs?: number;
  maxQueue?: number;
}

export interface RaycastNarrationQueueState {
  pending: string[];
  active: RaycastNarrationActive | null;
  queueCooldownUntilMs: number;
}

export interface RaycastNarrationActive {
  message: string;
  phase: 'fadeIn' | 'hold' | 'fadeOut';
  phaseStartedAtMs: number;
  displayMs: number;
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
  const panelWidth = Math.max(280, Math.min(420, Math.round(width * 0.4)));
  const panelHeight = 108;
  const marginX = 20;
  return {
    centerX: marginX + panelWidth * 0.5,
    centerY: height - 124,
    panelWidth,
    panelHeight,
    bodyWrapWidth: panelWidth - 40,
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
): RaycastNarrationQueueState {
  const normalized = normalizeNarrationMessage(message);
  if (!normalized) return state;

  if (!state.active) {
    return {
      ...state,
      active: startNarrationActive(normalized, nowMs, displayMs),
    };
  }

  const pending = [...state.pending, normalized].slice(-maxQueue);
  return { ...state, pending };
}

function startNarrationActive(
  message: string,
  nowMs: number,
  displayMs: number,
): RaycastNarrationActive {
  return {
    message,
    phase: 'fadeIn',
    phaseStartedAtMs: nowMs,
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
  const nextMessage = pending.shift();
  if (!nextMessage) {
    return { pending: [], active: null, queueCooldownUntilMs: 0 };
  }

  return {
    pending,
    active: startNarrationActive(nextMessage, nowMs, config.displayMs),
    queueCooldownUntilMs: 0,
  };
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

export function tickNarrationPhase(
  active: RaycastNarrationActive,
  nowMs: number,
  config: Required<RaycastNarrationOverlayConfig>,
): RaycastNarrationActive {
  const elapsed = Math.max(0, nowMs - active.phaseStartedAtMs);

  if (active.phase === 'fadeIn' && elapsed >= config.fadeInMs) {
    return { ...active, phase: 'hold', phaseStartedAtMs: nowMs };
  }

  if (active.phase === 'hold' && elapsed >= active.displayMs) {
    return { ...active, phase: 'fadeOut', phaseStartedAtMs: nowMs };
  }

  return active;
}
