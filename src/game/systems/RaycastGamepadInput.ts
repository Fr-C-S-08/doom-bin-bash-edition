import type { MovementVector } from './MovementSystem';

export const RAYCAST_GAMEPAD_DEFAULT_DEADZONE = 0.18;
export const RAYCAST_GAMEPAD_DEFAULT_LOOK_SENSITIVITY = 1;
export const RAYCAST_GAMEPAD_ACTIVATION_AXIS_THRESHOLD = 0.08;
export const RAYCAST_GAMEPAD_STATUS_COOLDOWN_MS = 2200;
export const RAYCAST_GAMEPAD_ANALOG_BUTTON_THRESHOLD = 0.45;

export type RaycastGamepadAction =
  | 'confirm'
  | 'cancel'
  | 'pause'
  | 'toggleMap'
  | 'reload'
  | 'fire'
  | 'nextWeapon'
  | 'previousWeapon'
  | 'navUp'
  | 'navDown'
  | 'navLeft'
  | 'navRight';

export const RAYCAST_GAMEPAD_COMBAT_ACTIONS = [
  'reload',
  'fire',
  'nextWeapon',
  'previousWeapon'
] as const satisfies readonly RaycastGamepadAction[];

export function shouldAllowRaycastCombatGamepadInput(gamePaused: boolean): boolean {
  return !gamePaused;
}

export interface RaycastGamepadSettings {
  leftDeadzone: number;
  rightDeadzone: number;
  lookSensitivity: number;
  invertLookY: boolean;
  vibrationEnabled: boolean;
}

export interface RaycastGamepadFrame {
  connected: boolean;
  label: string | null;
  move: MovementVector;
  look: MovementVector;
  heldActions: Set<RaycastGamepadAction>;
  pressedActions: Set<RaycastGamepadAction>;
}

export interface RaycastGamepadProbe {
  index: number;
  id: string;
  mapping: string;
  connected: boolean;
  buttonCount: number;
  axisCount: number;
  activeButtonIndices: number[];
  activeAxes: Array<{ index: number; value: number }>;
}

export interface RaycastGamepadDebugInfo {
  detected: boolean;
  connected: boolean;
  awaitingActivation: boolean;
  index: number | null;
  label: string | null;
  mapping: string | null;
  buttonCount: number;
  axisCount: number;
  liveInputLine: string | null;
}

export interface RaycastGamepadInputOptions {
  getGamepads?: () => ArrayLike<Gamepad | null>;
  getSettings?: () => RaycastGamepadSettings;
  enableBrowserEvents?: boolean;
  getNow?: () => number;
}

interface RaycastGamepadButtonLike {
  pressed?: boolean;
  value?: number;
}

interface RaycastGamepadLike {
  id: string;
  connected?: boolean;
  mapping?: string;
  axes: readonly number[];
  buttons: readonly RaycastGamepadButtonLike[];
}

interface RaycastGamepadAxisLayout {
  moveX: number;
  moveY: number;
  lookX: number;
  lookY: number;
}

type RaycastGamepadStatusKind = 'connected' | 'disconnected' | 'activation_hint';

const STANDARD_BUTTON_PADS: Record<RaycastGamepadAction, number[]> = {
  confirm: [0],
  cancel: [1],
  pause: [9],
  toggleMap: [8],
  reload: [2],
  fire: [7],
  nextWeapon: [5, 15],
  previousWeapon: [4, 14],
  navUp: [12],
  navDown: [13],
  navLeft: [14],
  navRight: [15]
};

/** Fallback for empty/non-standard mappings (8BitDo, Switch clones, etc.). */
const FALLBACK_BUTTON_PADS: Record<RaycastGamepadAction, number[]> = {
  confirm: [0, 1],
  cancel: [1, 0],
  pause: [9, 4, 8, 16],
  toggleMap: [8, 4],
  reload: [2, 5, 6],
  fire: [7, 6, 5, 11, 12, 13, 17, 18],
  nextWeapon: [5, 15, 4],
  previousWeapon: [4, 14, 5],
  navUp: [12],
  navDown: [13],
  navLeft: [14],
  navRight: [15]
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function hasRaycastGamepadCapabilities(gamepad: RaycastGamepadLike): boolean {
  return (gamepad.buttons?.length ?? 0) > 0 || (gamepad.axes?.length ?? 0) > 0;
}

export function isRaycastGamepadPresent(pad: Gamepad | null | undefined): pad is Gamepad {
  if (!pad) return false;
  if (!hasRaycastGamepadCapabilities(pad)) return false;
  if (pad.connected === false) {
    return Boolean(pad.id?.trim()) || hasRaycastGamepadUserInput(pad);
  }
  return true;
}

export function hasRaycastGamepadUserInput(
  gamepad: RaycastGamepadLike,
  axisThreshold = RAYCAST_GAMEPAD_ACTIVATION_AXIS_THRESHOLD
): boolean {
  for (const button of gamepad.buttons) {
    if (!button) continue;
    if (button.pressed || (button.value ?? 0) >= RAYCAST_GAMEPAD_ANALOG_BUTTON_THRESHOLD) return true;
  }
  for (const axis of gamepad.axes) {
    if (Math.abs(axis) > axisThreshold) return true;
  }
  return false;
}

export function scoreRaycastGamepadCandidate(pad: Gamepad, index: number, preferredIndex: number | null): number {
  let score = 0;
  if (index === preferredIndex) score += 120;
  if (pad.connected !== false) score += 60;
  if (hasRaycastGamepadUserInput(pad)) score += 50;
  if (pad.mapping === 'standard') score += 25;
  if (/8bitdo|8-bitdo|ultimate|pro\s*2|xbox|wireless controller/i.test(pad.id)) score += 35;
  score += Math.min(12, pad.buttons.length);
  score += Math.min(8, pad.axes.length);
  return score;
}

export function scanRaycastGamepads(
  pads: ArrayLike<Gamepad | null>,
  preferredIndex: number | null = null
): { index: number; pad: Gamepad } | null {
  let best: { index: number; pad: Gamepad; score: number } | null = null;

  for (let i = 0; i < pads.length; i += 1) {
    const pad = pads[i];
    if (!isRaycastGamepadPresent(pad)) continue;
    const score = scoreRaycastGamepadCandidate(pad, i, preferredIndex);
    if (!best || score > best.score) {
      best = { index: i, pad, score };
    }
  }

  return best ? { index: best.index, pad: best.pad } : null;
}

export function probeRaycastGamepad(pad: RaycastGamepadLike, index = 0): RaycastGamepadProbe {
  const activeButtonIndices: number[] = [];
  pad.buttons.forEach((button, buttonIndex) => {
    if (!button) return;
    if (button.pressed || (button.value ?? 0) >= RAYCAST_GAMEPAD_ANALOG_BUTTON_THRESHOLD) {
      activeButtonIndices.push(buttonIndex);
    }
  });

  const activeAxes: Array<{ index: number; value: number }> = [];
  pad.axes.forEach((value, axisIndex) => {
    if (Math.abs(value) > RAYCAST_GAMEPAD_ACTIVATION_AXIS_THRESHOLD) {
      activeAxes.push({ index: axisIndex, value: Number(value.toFixed(2)) });
    }
  });

  return {
    index,
    id: pad.id || 'sin nombre',
    mapping: pad.mapping?.trim() || '(vacío)',
    connected: pad.connected !== false,
    buttonCount: pad.buttons.length,
    axisCount: pad.axes.length,
    activeButtonIndices,
    activeAxes
  };
}

export function formatRaycastGamepadProbeSummary(probe: RaycastGamepadProbe): string {
  return `Mando · ${probe.id} · #${probe.index} · map ${probe.mapping} · ${probe.buttonCount}b/${probe.axisCount}a`;
}

export function formatRaycastGamepadLiveInputLine(probe: RaycastGamepadProbe | null): string {
  if (!probe) return 'Entradas · —';
  const buttons = probe.activeButtonIndices.length > 0 ? probe.activeButtonIndices.join(',') : '—';
  const axes =
    probe.activeAxes.length > 0
      ? probe.activeAxes.map((axis) => `${axis.index}:${axis.value}`).join(',')
      : '—';
  return `Activos · btn ${buttons} · ejes ${axes}`;
}

export function resolveRaycastGamepadAxisLayout(gamepad: RaycastGamepadLike): RaycastGamepadAxisLayout {
  const axisCount = gamepad.axes.length;
  if (gamepad.mapping === 'standard' || axisCount >= 4) {
    return { moveX: 0, moveY: 1, lookX: 2, lookY: 3 };
  }
  if (axisCount >= 2) {
    return { moveX: 0, moveY: 1, lookX: 0, lookY: 1 };
  }
  if (axisCount === 1) {
    return { moveX: 0, moveY: 0, lookX: 0, lookY: 0 };
  }
  return { moveX: 0, moveY: 1, lookX: 2, lookY: 3 };
}

export function resolveRaycastGamepadButtonPads(gamepad: RaycastGamepadLike): Record<RaycastGamepadAction, number[]> {
  if (gamepad.mapping === 'standard') return STANDARD_BUTTON_PADS;
  return FALLBACK_BUTTON_PADS;
}

function isRaycastGamepadButtonDown(gamepad: RaycastGamepadLike, buttonIndex: number): boolean {
  const button = gamepad.buttons[buttonIndex];
  if (!button) return false;
  return Boolean(button.pressed) || (button.value ?? 0) >= RAYCAST_GAMEPAD_ANALOG_BUTTON_THRESHOLD;
}

export function normalizeRaycastGamepadAxis(value: number, deadzone = RAYCAST_GAMEPAD_DEFAULT_DEADZONE): number {
  if (!Number.isFinite(value)) return 0;
  const abs = Math.abs(value);
  const clampedDeadzone = clamp(deadzone, 0, 0.95);
  if (abs <= clampedDeadzone) return 0;
  const scaled = (abs - clampedDeadzone) / (1 - clampedDeadzone);
  return Math.sign(value) * clamp(scaled, 0, 1);
}

export function normalizeRaycastGamepadStick(
  x: number,
  y: number,
  deadzone = RAYCAST_GAMEPAD_DEFAULT_DEADZONE
): MovementVector {
  return {
    x: normalizeRaycastGamepadAxis(x, deadzone),
    y: normalizeRaycastGamepadAxis(y, deadzone)
  };
}

export function readRaycastGamepadFrame(
  gamepad: RaycastGamepadLike,
  settings: RaycastGamepadSettings
): RaycastGamepadFrame {
  const axisLayout = resolveRaycastGamepadAxisLayout(gamepad);
  const buttonPads = resolveRaycastGamepadButtonPads(gamepad);
  const moveAxes = normalizeRaycastGamepadStick(
    gamepad.axes[axisLayout.moveX] ?? 0,
    gamepad.axes[axisLayout.moveY] ?? 0,
    settings.leftDeadzone
  );
  const lookRawX = gamepad.axes[axisLayout.lookX] ?? 0;
  const lookRawY = gamepad.axes[axisLayout.lookY] ?? 0;
  const heldActions = new Set<RaycastGamepadAction>();

  for (const action of Object.keys(buttonPads) as RaycastGamepadAction[]) {
    const indices = buttonPads[action];
    if (indices.some((index) => isRaycastGamepadButtonDown(gamepad, index))) {
      heldActions.add(action);
    }
  }

  const move: MovementVector = {
    x: moveAxes.x,
    y: -moveAxes.y
  };

  const look: MovementVector = {
    x: lookRawX,
    y: (settings.invertLookY ? 1 : -1) * lookRawY
  };

  return {
    connected: true,
    label: gamepad.id || null,
    move,
    look,
    heldActions,
    pressedActions: new Set(heldActions)
  };
}

export function shouldBroadcastRaycastGamepadStatus(
  previous: RaycastGamepadStatusKind | null,
  next: RaycastGamepadStatusKind,
  nowMs: number,
  lastBroadcastAtMs: number
): boolean {
  if (previous === next) return false;
  if (lastBroadcastAtMs <= 0) return true;
  return nowMs - lastBroadcastAtMs >= RAYCAST_GAMEPAD_STATUS_COOLDOWN_MS;
}

export class RaycastGamepadInput {
  private readonly getGamepads: () => ArrayLike<Gamepad | null>;
  private readonly getSettings: () => RaycastGamepadSettings;
  private readonly getNow: () => number;
  private activeIndex: number | null = null;
  private connected = false;
  private activeLabel: string | null = null;
  private activeMapping: string | null = null;
  private awaitingActivation = false;
  private lastProbe: RaycastGamepadProbe | null = null;
  private currentMove: MovementVector = { x: 0, y: 0 };
  private currentLook: MovementVector = { x: 0, y: 0 };
  private heldActions = new Set<RaycastGamepadAction>();
  private pressedActions = new Set<RaycastGamepadAction>();
  private statusMessage: string | null = null;
  private statusMessageUntil = 0;
  private lastStatusBroadcast: RaycastGamepadStatusKind | null = null;
  private lastStatusBroadcastAt = 0;
  private browserEventsAttached = false;
  private readonly handleBrowserConnectionChange = (): void => {
    this.awaitingActivation = true;
    this.rescanActiveGamepad();
  };

  constructor(options: RaycastGamepadInputOptions = {}) {
    this.getGamepads =
      options.getGamepads ??
      (() => (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : []));
    this.getSettings =
      options.getSettings ??
      (() => ({
        leftDeadzone: RAYCAST_GAMEPAD_DEFAULT_DEADZONE,
        rightDeadzone: RAYCAST_GAMEPAD_DEFAULT_DEADZONE,
        lookSensitivity: RAYCAST_GAMEPAD_DEFAULT_LOOK_SENSITIVITY,
        invertLookY: false,
        vibrationEnabled: false
      }));
    this.getNow = options.getNow ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    if (options.enableBrowserEvents !== false) this.attachBrowserEvents();
  }

  destroy(): void {
    if (this.browserEventsAttached && typeof window !== 'undefined') {
      window.removeEventListener('gamepadconnected', this.handleBrowserConnectionChange);
      window.removeEventListener('gamepaddisconnected', this.handleBrowserConnectionChange);
    }
    this.browserEventsAttached = false;
  }

  update(): RaycastGamepadFrame {
    const gamepad = this.rescanActiveGamepad();
    const settings = this.getSettings();
    const now = this.getNow();

    if (!gamepad) {
      this.lastProbe = null;
      if (this.connected) {
        this.broadcastStatus('disconnected', 'Control desconectado', now);
      }
      this.connected = false;
      this.activeLabel = null;
      this.activeMapping = null;
      this.currentMove = { x: 0, y: 0 };
      this.currentLook = { x: 0, y: 0 };
      this.heldActions.clear();
      this.pressedActions.clear();
      if (this.awaitingActivation) {
        this.broadcastStatus('activation_hint', 'Presiona cualquier botón del control para activarlo', now);
      }
      return this.getFrame();
    }

    this.lastProbe = probeRaycastGamepad(gamepad, this.activeIndex ?? 0);
    this.awaitingActivation = false;
    if (!this.connected) {
      this.broadcastStatus('connected', 'Control detectado', now);
    }
    this.connected = true;
    this.activeLabel = gamepad.id || null;
    this.activeMapping = gamepad.mapping?.trim() || '(vacío)';

    const frame = readRaycastGamepadFrame(gamepad, settings);
    const nextPressed = new Set<RaycastGamepadAction>();
    for (const action of frame.heldActions) {
      if (!this.heldActions.has(action)) nextPressed.add(action);
    }

    this.currentMove = frame.move;
    this.currentLook = frame.look;
    this.heldActions = frame.heldActions;
    this.pressedActions = nextPressed;
    return this.getFrame();
  }

  consumePressed(action: RaycastGamepadAction): boolean {
    if (!this.pressedActions.has(action)) return false;
    this.pressedActions.delete(action);
    return true;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getLabel(): string | null {
    return this.activeLabel;
  }

  getProbe(): RaycastGamepadProbe | null {
    return this.lastProbe;
  }

  getDebugInfo(): RaycastGamepadDebugInfo {
    const pads = this.getGamepads();
    const scan = scanRaycastGamepads(pads, this.activeIndex);
    const probePad = this.connected && this.activeIndex !== null ? pads[this.activeIndex] : scan?.pad ?? null;
    const probe =
      probePad && isRaycastGamepadPresent(probePad)
        ? probeRaycastGamepad(probePad, scan?.index ?? this.activeIndex ?? 0)
        : this.lastProbe;

    return {
      detected: scan !== null,
      connected: this.connected,
      awaitingActivation: this.awaitingActivation && !this.connected,
      index: this.connected ? this.activeIndex : scan?.index ?? null,
      label: this.connected ? this.activeLabel : scan?.pad.id ?? null,
      mapping: this.connected ? this.activeMapping : probe?.mapping ?? null,
      buttonCount: probe?.buttonCount ?? 0,
      axisCount: probe?.axisCount ?? 0,
      liveInputLine: formatRaycastGamepadLiveInputLine(probe)
    };
  }

  getMoveInput(): MovementVector {
    return { ...this.currentMove };
  }

  getLookInput(): MovementVector {
    return { ...this.currentLook };
  }

  consumeStatusMessage(): string | null {
    if (this.statusMessage && this.getNow() > this.statusMessageUntil) {
      this.statusMessage = null;
    }
    const message = this.statusMessage;
    this.statusMessage = null;
    return message;
  }

  vibrate(kind: 'light' | 'damage' | 'boss'): void {
    if (!this.getSettings().vibrationEnabled) return;
    const gamepad = this.getCurrentGamepad();
    if (!gamepad) return;
    const actuator = (gamepad as Gamepad & { vibrationActuator?: { playEffect?: (effect: string, params: Record<string, number>) => Promise<unknown> } }).vibrationActuator;
    if (!actuator || typeof actuator.playEffect !== 'function') return;

    const params =
      kind === 'boss'
        ? { duration: 220, strongMagnitude: 0.95, weakMagnitude: 0.7 }
        : kind === 'damage'
          ? { duration: 100, strongMagnitude: 0.42, weakMagnitude: 0.28 }
          : { duration: 72, strongMagnitude: 0.22, weakMagnitude: 0.14 };

    void actuator.playEffect('dual-rumble', params).catch(() => undefined);
  }

  private attachBrowserEvents(): void {
    if (this.browserEventsAttached || typeof window === 'undefined') return;
    window.addEventListener('gamepadconnected', this.handleBrowserConnectionChange);
    window.addEventListener('gamepaddisconnected', this.handleBrowserConnectionChange);
    this.browserEventsAttached = true;
  }

  private broadcastStatus(kind: RaycastGamepadStatusKind, message: string, nowMs: number): void {
    if (!shouldBroadcastRaycastGamepadStatus(this.lastStatusBroadcast, kind, nowMs, this.lastStatusBroadcastAt)) {
      return;
    }
    this.lastStatusBroadcast = kind;
    this.lastStatusBroadcastAt = nowMs;
    this.statusMessage = message;
    this.statusMessageUntil = nowMs + 1800;
  }

  private getFrame(): RaycastGamepadFrame {
    return {
      connected: this.connected,
      label: this.activeLabel,
      move: { ...this.currentMove },
      look: { ...this.currentLook },
      heldActions: new Set(this.heldActions),
      pressedActions: new Set(this.pressedActions)
    };
  }

  private getCurrentGamepad(): Gamepad | null {
    const pads = this.getGamepads();
    if (this.activeIndex !== null) {
      const pad = pads[this.activeIndex];
      if (isRaycastGamepadPresent(pad)) return pad;
    }
    return scanRaycastGamepads(pads)?.pad ?? null;
  }

  private rescanActiveGamepad(): Gamepad | null {
    const pads = this.getGamepads();
    const found = scanRaycastGamepads(pads, this.activeIndex);
    if (found) {
      this.activeIndex = found.index;
      return found.pad;
    }

    if (this.activeIndex !== null) {
      this.activeIndex = null;
    }

    return null;
  }
}
