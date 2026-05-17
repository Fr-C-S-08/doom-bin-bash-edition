import type { MovementVector } from './MovementSystem';

export const RAYCAST_GAMEPAD_DEFAULT_DEADZONE = 0.18;
export const RAYCAST_GAMEPAD_DEFAULT_LOOK_SENSITIVITY = 1;

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
  mapping?: string;
  axes: readonly number[];
  buttons: readonly RaycastGamepadButtonLike[];
}

const RAYCAST_GAMEPAD_BUTTON_PADS: Record<RaycastGamepadAction, number[]> = {
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
  const moveAxes = normalizeRaycastGamepadStick(gamepad.axes[0] ?? 0, gamepad.axes[1] ?? 0, settings.leftDeadzone);
  const lookAxes = normalizeRaycastGamepadStick(gamepad.axes[2] ?? 0, gamepad.axes[3] ?? 0, settings.rightDeadzone);
  const heldActions = new Set<RaycastGamepadAction>();

  const isButtonDown = (buttonIndex: number): boolean => {
    const button = gamepad.buttons[buttonIndex];
    if (!button) return false;
    return Boolean(button.pressed) || (button.value ?? 0) >= 0.5;
  };

  const addAction = (action: RaycastGamepadAction, active: boolean): void => {
    if (!active) return;
    heldActions.add(action);
  };

  for (const action of Object.keys(RAYCAST_GAMEPAD_BUTTON_PADS) as RaycastGamepadAction[]) {
    const indices = RAYCAST_GAMEPAD_BUTTON_PADS[action];
    const active = indices.some((index) => isButtonDown(index));
    addAction(action, active);
  }

  // Forward-positive movement keeps the stick semantics aligned with WASD: up = forward.
  const move: MovementVector = {
    x: moveAxes.x,
    y: -moveAxes.y
  };

  // Look axes are scaled separately so the right stick feels readable without mouse-level jumps.
  const look: MovementVector = {
    x: lookAxes.x * Math.max(0.1, settings.lookSensitivity),
    y: (settings.invertLookY ? 1 : -1) * lookAxes.y * Math.max(0.1, settings.lookSensitivity)
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

export class RaycastGamepadInput {
  private readonly getGamepads: () => ArrayLike<Gamepad | null>;
  private readonly getSettings: () => RaycastGamepadSettings;
  private readonly getNow: () => number;
  private activeIndex: number | null = null;
  private connected = false;
  private activeLabel: string | null = null;
  private currentMove: MovementVector = { x: 0, y: 0 };
  private currentLook: MovementVector = { x: 0, y: 0 };
  private heldActions = new Set<RaycastGamepadAction>();
  private pressedActions = new Set<RaycastGamepadAction>();
  private statusMessage: string | null = null;
  private statusMessageUntil = 0;
  private browserEventsAttached = false;
  private readonly handleBrowserConnectionChange = (): void => {
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

    if (!gamepad) {
      this.connected = false;
      this.activeLabel = null;
      this.currentMove = { x: 0, y: 0 };
      this.currentLook = { x: 0, y: 0 };
      this.heldActions.clear();
      this.pressedActions.clear();
      return this.getFrame();
    }

    if (!this.connected) this.pushStatusMessage('CONTROL DETECTADO');
    this.connected = true;
    this.activeLabel = gamepad.id || null;

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

  private pushStatusMessage(message: string): void {
    this.statusMessage = message;
    this.statusMessageUntil = this.getNow() + 1800;
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
    const index = this.activeIndex;
    if (index !== null) {
      const pad = pads[index];
      if (pad) return pad;
    }
    for (let i = 0; i < pads.length; i += 1) {
      const pad = pads[i];
      if (pad) return pad;
    }
    return null;
  }

  private rescanActiveGamepad(): Gamepad | null {
    const pads = this.getGamepads();
    if (this.activeIndex !== null) {
      const current = pads[this.activeIndex];
      if (current) return current;
      this.activeIndex = null;
      if (this.connected) this.pushStatusMessage('CONTROL DESCONECTADO');
    }

    for (let i = 0; i < pads.length; i += 1) {
      const pad = pads[i];
      if (!pad) continue;
      this.activeIndex = i;
      return pad;
    }

    return null;
  }
}
