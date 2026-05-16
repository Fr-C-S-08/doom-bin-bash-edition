import type Phaser from 'phaser';
import type { MovementVector } from './MovementSystem';

export type RaycastTouchAction =
  | 'confirm'
  | 'cancel'
  | 'pause'
  | 'toggleMap'
  | 'reload'
  | 'fire'
  | 'nextWeapon'
  | 'previousWeapon'
  | 'weapon1'
  | 'weapon2'
  | 'weapon3'
  | 'navUp'
  | 'navDown'
  | 'navLeft'
  | 'navRight';

export type RaycastTouchMode = 'gameplay' | 'ui';

export interface RaycastTouchSettings {
  enabled: boolean;
  buttonScale: number;
  lookSensitivity: number;
  joystickDeadzone: number;
}

export interface RaycastTouchInputOptions {
  getSettings?: () => RaycastTouchSettings;
  getNow?: () => number;
  getViewport?: () => { width: number; height: number };
  hasTouchCapability?: () => boolean;
  mode?: RaycastTouchMode;
}

export interface RaycastTouchLayout {
  width: number;
  height: number;
  buttonScale: number;
  buttonSize: number;
  joystickRadius: number;
  joystickCenterX: number;
  joystickCenterY: number;
  rotateLeftX: number;
  rotateRightX: number;
  rotateCenterY: number;
  bottomPad: number;
  leftPad: number;
  rightPad: number;
  portraitPrompt: boolean;
}

interface TouchButtonSpec {
  action: RaycastTouchAction;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  gameplayOnly?: boolean;
}

interface TouchButtonState {
  action: RaycastTouchAction;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  spec: TouchButtonSpec;
  active: boolean;
  pressed: boolean;
  pointerId: number | null;
}

type TouchPointerKind = 'joystick' | 'look' | 'button';

interface TouchPointerState {
  kind: TouchPointerKind;
  action?: RaycastTouchAction;
  pointerId: number;
  originX: number;
  originY: number;
  lastX: number;
  lastY: number;
}

const TOUCH_MAX_LOOK_DELTA_RADIANS = Math.PI * 0.33;
const TOUCH_MAX_LOOK_PIXEL_DELTA = 96;
const TOUCH_MIN_LOOK_PIXEL_DELTA = 1.75;
const TOUCH_LOOK_SMOOTH_ALPHA = 0.42;
const TOUCH_PALM_REJECT_BOTTOM_FRAC = 0.07;
const TOUCH_DEFAULT_BUTTON_SCALE = 1;
const TOUCH_DEFAULT_LOOK_SENSITIVITY = 0.011;
const TOUCH_DEFAULT_JOYSTICK_DEADZONE = 0.18;
const TOUCH_MAX_JOYSTICK_POINTERS = 1;
const TOUCH_MAX_LOOK_POINTERS = 1;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isTouchLikePointer(pointer: Phaser.Input.Pointer): boolean {
  const event = pointer.event as PointerEvent | undefined;
  return Boolean(event && event.pointerType === 'touch');
}

export function normalizeRaycastTouchAxis(value: number, deadzone = TOUCH_DEFAULT_JOYSTICK_DEADZONE): number {
  if (!Number.isFinite(value)) return 0;
  const abs = Math.abs(value);
  const clampedDeadzone = clamp(deadzone, 0, 0.95);
  if (abs <= clampedDeadzone) return 0;
  const scaled = (abs - clampedDeadzone) / (1 - clampedDeadzone);
  return Math.sign(value) * clamp(scaled, 0, 1);
}

export function normalizeRaycastTouchStick(
  x: number,
  y: number,
  deadzone = TOUCH_DEFAULT_JOYSTICK_DEADZONE
): MovementVector {
  return {
    x: normalizeRaycastTouchAxis(x, deadzone),
    y: normalizeRaycastTouchAxis(y, deadzone)
  };
}

export function clampRaycastTouchLookDelta(deltaRadians: number, maxDeltaRadians = TOUCH_MAX_LOOK_DELTA_RADIANS): number {
  if (!Number.isFinite(deltaRadians)) return 0;
  const cap = Math.max(0, maxDeltaRadians);
  return cap === 0 ? 0 : clamp(deltaRadians, -cap, cap);
}

export function computeRaycastTouchJoystickVector(
  originX: number,
  originY: number,
  currentX: number,
  currentY: number,
  radius: number,
  deadzone = TOUCH_DEFAULT_JOYSTICK_DEADZONE
): MovementVector {
  const safeRadius = Math.max(1, radius);
  const dx = currentX - originX;
  const dy = currentY - originY;
  const magnitude = Math.hypot(dx, dy);
  if (magnitude === 0) return { x: 0, y: 0 };
  const clampedMagnitude = Math.min(1, magnitude / safeRadius);
  const eased = normalizeRaycastTouchAxis(clampedMagnitude, deadzone);
  if (eased === 0) return { x: 0, y: 0 };
  const x = clamp((dx / magnitude) * eased, -1, 1);
  const y = clamp((dy / magnitude) * eased, -1, 1);
  return { x, y };
}

export function collectRaycastTouchPressedActions(queue: Set<RaycastTouchAction>): Set<RaycastTouchAction> {
  const actions = new Set(queue);
  queue.clear();
  return actions;
}

export function isRaycastTouchPortrait(width: number, height: number): boolean {
  return height > width;
}

export function shouldShowRaycastTouchControls(input: {
  enabled: boolean;
  maxTouchPoints: number;
  width: number;
  height: number;
}): boolean {
  return input.enabled && input.maxTouchPoints > 0 && input.width > 0 && input.height > 0;
}

export function buildRaycastTouchLayout(width: number, height: number, buttonScale = TOUCH_DEFAULT_BUTTON_SCALE): RaycastTouchLayout {
  const scale = clamp(Number.isFinite(buttonScale) ? buttonScale : TOUCH_DEFAULT_BUTTON_SCALE, 0.75, 1.45);
  const buttonSize = clamp(Math.round(Math.min(width, height) * 0.105 * scale), 42, 86);
  const joystickRadius = clamp(Math.round(buttonSize * 1.24), 50, 122);
  const leftPad = Math.round(Math.max(16, width * 0.03));
  const rightPad = Math.round(Math.max(16, width * 0.03));
  const bottomPad = Math.round(Math.max(16, height * 0.03));
  const joystickCenterX = leftPad + joystickRadius;
  const joystickCenterY = height - bottomPad - joystickRadius * 0.88;
  const rotateCenterY = height * 0.5;
  const rotateLeftX = width * 0.57;
  const rotateRightX = width * 0.85;
  return {
    width,
    height,
    buttonScale: scale,
    buttonSize,
    joystickRadius,
    joystickCenterX,
    joystickCenterY,
    rotateLeftX,
    rotateRightX,
    rotateCenterY,
    bottomPad,
    leftPad,
    rightPad,
    portraitPrompt: isRaycastTouchPortrait(width, height)
  };
}

export function buildRaycastTouchButtonSpecs(layout: RaycastTouchLayout, mode: RaycastTouchMode): TouchButtonSpec[] {
  const s = layout.buttonSize;
  const clusterY = layout.height - layout.bottomPad - s * 0.5;
  const topY = clusterY - s * 1.15;
  const actionX = layout.width - layout.rightPad - s * 0.5;
  const secondX = actionX - s * 1.18;
  const thirdX = secondX - s * 1.18;
  const fourthX = thirdX - s * 1.18;
  const dPadX = layout.leftPad + s * 0.5;
  const dPadY = clusterY;

  if (mode === 'gameplay') {
    return [
      { action: 'fire', label: 'DISPARAR', x: actionX, y: clusterY, width: s * 1.25, height: s * 1.25 },
      { action: 'reload', label: 'RECARGAR', x: secondX, y: clusterY, width: s * 1.15, height: s * 1.15 },
      { action: 'pause', label: 'PAUSA', x: thirdX, y: clusterY, width: s * 1.05, height: s * 1.05 },
      { action: 'toggleMap', label: 'MAPA', x: fourthX, y: clusterY, width: s * 1.0, height: s * 1.0 },
      { action: 'weapon3', label: '3', x: actionX, y: topY, width: s * 0.8, height: s * 0.8 },
      { action: 'weapon2', label: '2', x: secondX, y: topY, width: s * 0.8, height: s * 0.8 },
      { action: 'weapon1', label: '1', x: thirdX, y: topY, width: s * 0.8, height: s * 0.8 },
      { action: 'previousWeapon', label: '◀', x: dPadX - s * 1.02, y: dPadY, width: s * 0.72, height: s * 0.72 },
      { action: 'nextWeapon', label: '▶', x: dPadX + s * 1.02, y: dPadY, width: s * 0.72, height: s * 0.72 }
    ];
  }

  return [
    { action: 'navUp', label: '↑', x: dPadX, y: dPadY - s * 0.96, width: s * 0.72, height: s * 0.72 },
    { action: 'navDown', label: '↓', x: dPadX, y: dPadY + s * 0.96, width: s * 0.72, height: s * 0.72 },
    { action: 'navLeft', label: '◀', x: dPadX - s * 1.02, y: dPadY, width: s * 0.72, height: s * 0.72 },
    { action: 'navRight', label: '▶', x: dPadX + s * 1.02, y: dPadY, width: s * 0.72, height: s * 0.72 },
    { action: 'confirm', label: 'A', x: actionX, y: clusterY, width: s * 1.02, height: s * 1.02 },
    { action: 'cancel', label: 'B', x: secondX, y: clusterY, width: s * 1.02, height: s * 1.02 }
  ];
}

function containsButton(button: TouchButtonState, x: number, y: number): boolean {
  const halfW = button.spec.width * 0.5;
  const halfH = button.spec.height * 0.5;
  return x >= button.spec.x - halfW && x <= button.spec.x + halfW && y >= button.spec.y - halfH && y <= button.spec.y + halfH;
}

function isRaycastTouchTextObject(gameObject: Phaser.GameObjects.GameObject): gameObject is Phaser.GameObjects.Text {
  return Boolean(
    gameObject &&
      typeof (gameObject as { text?: unknown }).text === 'string' &&
      typeof (gameObject as { setVisible?: unknown }).setVisible === 'function'
  );
}

export interface RaycastTouchTransientState {
  activePointers: Map<number, TouchPointerState>;
  currentMove: MovementVector;
  currentLook: MovementVector;
  heldActions: Set<RaycastTouchAction>;
  pressedActions: Set<RaycastTouchAction>;
  buttons?: Iterable<Pick<TouchButtonState, 'pressed' | 'pointerId'>>;
}

/** Clears sticks, pointers, held/pressed actions — safe on pause, blur, or overlay rebuild. */
export function clearRaycastTouchTransientState(state: RaycastTouchTransientState): void {
  state.activePointers.clear();
  state.currentMove = { x: 0, y: 0 };
  state.currentLook = { x: 0, y: 0 };
  state.heldActions.clear();
  state.pressedActions.clear();
  if (state.buttons) {
    for (const button of state.buttons) {
      button.pressed = false;
      button.pointerId = null;
    }
  }
}

/** UI/menu mode must not swallow taps outside overlay buttons (Phaser interactives below). */
export function shouldRaycastTouchPreventDefault(mode: RaycastTouchMode, capturedOverlayGesture: boolean): boolean {
  if (!capturedOverlayGesture) return false;
  return mode === 'gameplay';
}

export function shouldRaycastTouchCaptureBackgroundPointer(mode: RaycastTouchMode, hitOverlayButton: boolean): boolean {
  if (hitOverlayButton) return true;
  return mode === 'gameplay';
}

export class RaycastTouchInput {
  private readonly scene: Phaser.Scene;
  private readonly getSettings: () => RaycastTouchSettings;
  private readonly getNow: () => number;
  private readonly getViewport: () => { width: number; height: number };
  private readonly hasTouchCapability: () => boolean;
  private mode: RaycastTouchMode;
  private connected = false;
  private active = false;
  private layout: RaycastTouchLayout;
  private readonly overlay = new Set<Phaser.GameObjects.GameObject>();
  private readonly buttons = new Map<RaycastTouchAction, TouchButtonState>();
  private readonly activePointers = new Map<number, TouchPointerState>();
  private joystickBase: Phaser.GameObjects.Arc | null = null;
  private joystickThumb: Phaser.GameObjects.Arc | null = null;
  private currentMove: MovementVector = { x: 0, y: 0 };
  private currentLook: MovementVector = { x: 0, y: 0 };
  private queuedLook: MovementVector = { x: 0, y: 0 };
  private queuedPressedActions = new Set<RaycastTouchAction>();
  private heldActions = new Set<RaycastTouchAction>();
  private pressedActions = new Set<RaycastTouchAction>();
  private statusMessage: string | null = null;
  private statusMessageUntil = 0;
  private lookSuppressionFrames = 0;
  private smoothedLookX = 0;
  private audioUnlocked = false;
  private lastViewport = { width: 0, height: 0 };
  private wasTouchVisible = false;
  private wasPortraitPrompt = false;
  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    this.processPointerDown(pointer);
  };
  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    this.processPointerMove(pointer);
  };
  private readonly handlePointerUp = (pointer: Phaser.Input.Pointer): void => {
    this.processPointerUp(pointer);
  };
  private readonly handleWindowBlur = (): void => {
    this.resetActiveContactState();
  };
  private readonly handleWindowFocus = (): void => {
    this.resetActiveContactState();
    this.suppressLookInput(2);
  };
  private readonly handleVisibilityChange = (): void => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      this.resetActiveContactState();
      return;
    }
    this.resetActiveContactState();
    this.suppressLookInput(2);
  };
  private readonly handlePageHide = (): void => {
    this.resetActiveContactState();
  };
  private readonly handlePageShow = (): void => {
    this.resetActiveContactState();
    this.suppressLookInput(2);
  };

  constructor(scene: Phaser.Scene, options: RaycastTouchInputOptions = {}) {
    this.scene = scene;
    this.getSettings =
      options.getSettings ??
      (() => ({
        enabled: true,
        buttonScale: TOUCH_DEFAULT_BUTTON_SCALE,
        lookSensitivity: 1,
        joystickDeadzone: TOUCH_DEFAULT_JOYSTICK_DEADZONE
      }));
    this.getNow = options.getNow ?? (() => (typeof performance !== 'undefined' ? performance.now() : Date.now()));
    this.getViewport = options.getViewport ?? (() => ({ width: scene.scale.width, height: scene.scale.height }));
    this.hasTouchCapability =
      options.hasTouchCapability ??
      (() =>
        typeof navigator !== 'undefined' &&
        (navigator.maxTouchPoints > 0 ||
          (typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches)));
    this.mode = options.mode ?? 'gameplay';
    this.layout = buildRaycastTouchLayout(this.getViewport().width, this.getViewport().height, this.getSettings().buttonScale);
  }

  create(): void {
    this.scene.input.addPointer(3);
    this.scene.input.on('pointerdown', this.handlePointerDown);
    this.scene.input.on('pointermove', this.handlePointerMove);
    this.scene.input.on('pointerup', this.handlePointerUp);
    this.scene.input.on('gameout', this.handlePointerUp);
    if (typeof window !== 'undefined') {
      window.addEventListener('blur', this.handleWindowBlur);
      window.addEventListener('focus', this.handleWindowFocus);
    }
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
      document.addEventListener('pagehide', this.handlePageHide);
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('pageshow', this.handlePageShow);
    }
    this.rebuildOverlay();
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.handlePointerDown);
    this.scene.input.off('pointermove', this.handlePointerMove);
    this.scene.input.off('pointerup', this.handlePointerUp);
    this.scene.input.off('gameout', this.handlePointerUp);
    if (typeof window !== 'undefined') {
      window.removeEventListener('blur', this.handleWindowBlur);
      window.removeEventListener('focus', this.handleWindowFocus);
      window.removeEventListener('pageshow', this.handlePageShow);
    }
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
      document.removeEventListener('pagehide', this.handlePageHide);
    }
    this.resetActiveContactState();
    this.clearOverlay();
  }

  setMode(mode: RaycastTouchMode): void {
    if (this.mode === mode) return;
    this.resetActiveContactState();
    this.mode = mode;
    this.rebuildOverlay();
    this.suppressLookInput(2);
  }

  /** Drop active contacts when pausing, losing focus, or rebuilding overlay. */
  resetActiveContactState(): void {
    this.smoothedLookX = 0;
    this.queuedLook = { x: 0, y: 0 };
    this.releaseCapturedPointers();
    clearRaycastTouchTransientState({
      activePointers: this.activePointers,
      currentMove: this.currentMove,
      currentLook: this.currentLook,
      heldActions: this.heldActions,
      pressedActions: this.pressedActions,
      buttons: this.buttons.values()
    });
    this.lookSuppressionFrames = Math.max(this.lookSuppressionFrames, 1);
  }

  update(): void {
    this.pressedActions = collectRaycastTouchPressedActions(this.queuedPressedActions);
    const viewport = this.getViewport();
    const settings = this.getSettings();
    const touchVisible = this.shouldDisplayTouchControls(settings, viewport.width, viewport.height);
    if (touchVisible !== this.wasTouchVisible) {
      this.pushStatusMessage(touchVisible ? 'CONTROL TÁCTIL DETECTADO' : 'CONTROL TÁCTIL DESACTIVADO', 1400);
      this.wasTouchVisible = touchVisible;
    }
    if (touchVisible && this.layout.portraitPrompt !== this.wasPortraitPrompt) {
      if (this.layout.portraitPrompt) this.pushStatusMessage('GIRA TU iPAD PARA JUGAR EN HORIZONTAL', 1800);
      this.wasPortraitPrompt = this.layout.portraitPrompt;
    }
    this.connected = touchVisible;
    this.active = touchVisible && this.layout.portraitPrompt === false;

    if (viewport.width !== this.lastViewport.width || viewport.height !== this.lastViewport.height) {
      this.lastViewport = viewport;
      this.layout = buildRaycastTouchLayout(viewport.width, viewport.height, settings.buttonScale);
      this.rebuildOverlay();
    }

    if (!touchVisible) {
      this.currentMove = { x: 0, y: 0 };
      this.currentLook = { x: 0, y: 0 };
      this.activePointers.clear();
      this.recomputeTouchState();
      return;
    }

    if (this.layout.portraitPrompt) {
      this.currentMove = { x: 0, y: 0 };
      this.currentLook = { x: 0, y: 0 };
      this.activePointers.clear();
      this.recomputeTouchState();
      this.showPortraitPrompt(true);
      this.showAudioPrompt(!this.audioUnlocked);
      return;
    }

    this.showPortraitPrompt(false);
    this.showAudioPrompt(!this.audioUnlocked);
    this.updateButtonVisuals();

    if (this.lookSuppressionFrames > 0) this.lookSuppressionFrames -= 1;
    this.currentMove = this.computeJoystickVector(settings.joystickDeadzone);
    if (this.lookSuppressionFrames > 0) {
      this.currentLook = { x: 0, y: 0 };
      this.smoothedLookX = 0;
      this.queuedLook = { x: 0, y: 0 };
    } else if (!Array.from(this.activePointers.values()).some((pointer) => pointer.kind === 'look')) {
      this.currentLook = { x: 0, y: 0 };
      this.smoothedLookX = 0;
    } else {
      const queued = { ...this.queuedLook };
      this.queuedLook = { x: 0, y: 0 };
      const rawLookX = clampRaycastTouchLookDelta(queued.x);
      this.smoothedLookX += (rawLookX - this.smoothedLookX) * TOUCH_LOOK_SMOOTH_ALPHA;
      this.currentLook = {
        x: this.smoothedLookX,
        y: queued.y
      };
    }
  }

  isConnected(): boolean {
    return this.connected;
  }

  isActive(): boolean {
    return this.active;
  }

  consumePressed(action: RaycastTouchAction): boolean {
    if (!this.pressedActions.has(action)) return false;
    this.pressedActions.delete(action);
    return true;
  }

  getMoveInput(): MovementVector {
    return { ...this.currentMove };
  }

  getLookInput(): MovementVector {
    return { ...this.currentLook };
  }

  consumeStatusMessage(): string | null {
    if (this.statusMessage && this.getNow() > this.statusMessageUntil) this.statusMessage = null;
    const message = this.statusMessage;
    this.statusMessage = null;
    return message;
  }

  pushStatusMessage(message: string, durationMs = 1600): void {
    this.statusMessage = message;
    this.statusMessageUntil = this.getNow() + Math.max(300, durationMs);
  }

  suppressLookInput(frames = 2): void {
    const safeFrames = Math.max(1, Math.floor(frames));
    this.lookSuppressionFrames = Math.max(this.lookSuppressionFrames, safeFrames);
    this.smoothedLookX = 0;
  }

  private isLikelyPalmRestTouch(x: number, y: number): boolean {
    const palmBandY = this.layout.height * (1 - TOUCH_PALM_REJECT_BOTTOM_FRAC);
    if (y < palmBandY) return false;
    const inJoystick =
      Math.hypot(x - this.layout.joystickCenterX, y - this.layout.joystickCenterY) <= this.layout.joystickRadius * 1.15;
    if (inJoystick) return false;
    if (this.findButtonAt(x, y)) return false;
    return x >= this.layout.width * 0.22;
  }

  private countPointers(kind: TouchPointerKind): number {
    return Array.from(this.activePointers.values()).filter((pointer) => pointer.kind === kind).length;
  }

  private shouldDisplayTouchControls(settings: RaycastTouchSettings, width: number, height: number): boolean {
    return shouldShowRaycastTouchControls({
      enabled: settings.enabled,
      maxTouchPoints: this.hasTouchCapability() ? 1 : 0,
      width,
      height
    });
  }

  private rebuildOverlay(): void {
    this.resetActiveContactState();
    this.clearOverlay();
    const settings = this.getSettings();
    const { width, height } = this.getViewport();
    if (!this.shouldDisplayTouchControls(settings, width, height)) return;

    const title = this.scene.add
      .text(width * 0.5, 14, this.layout.portraitPrompt ? 'GIRA TU iPAD PARA JUGAR EN HORIZONTAL' : 'TOCA PARA ACTIVAR AUDIO', {
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: '700',
        color: '#bfffee',
        backgroundColor: '#020408aa',
        padding: { x: 8, y: 4 },
        align: 'center'
      })
      .setOrigin(0.5, 0)
      .setDepth(90);
    this.overlay.add(title);
    this.showPortraitPrompt(this.layout.portraitPrompt);
    this.showAudioPrompt(true);

    const specs = buildRaycastTouchButtonSpecs(this.layout, this.mode);
    for (const spec of specs) {
      const button = this.scene.add
        .rectangle(spec.x, spec.y, spec.width, spec.height, 0x071018, 0.72)
        .setStrokeStyle(2, 0x6bf2d5, 0.5)
        .setDepth(91)
        .setInteractive({ useHandCursor: false });
      const label = this.scene.add
        .text(spec.x, spec.y, spec.label, {
          fontFamily: 'monospace',
          fontSize: spec.label.length <= 2 ? '17px' : '11px',
          fontStyle: '700',
          color: '#edf7f3',
          align: 'center'
        })
        .setOrigin(0.5)
        .setDepth(92);
      const state: TouchButtonState = {
        action: spec.action,
        rect: button,
        label,
        spec,
        active: true,
        pressed: false,
        pointerId: null
      };
      this.buttons.set(spec.action, state);
      this.overlay.add(button);
      this.overlay.add(label);
    }

    if (this.mode === 'gameplay') {
      this.createGameplayJoystick();
      this.createGameplayLookHint();
    } else {
      this.createUiPad();
    }
    this.applyModeVisibility();
  }

  private clearOverlay(): void {
    for (const child of this.overlay) {
      if ('destroy' in child && typeof child.destroy === 'function') child.destroy();
    }
    this.overlay.clear();
    this.buttons.clear();
    this.joystickBase = null;
    this.joystickThumb = null;
  }

  private createGameplayJoystick(): void {
    const outer = this.scene.add
      .circle(this.layout.joystickCenterX, this.layout.joystickCenterY, this.layout.joystickRadius, 0x061015, 0.5)
      .setStrokeStyle(2, 0x58f2e4, 0.55)
      .setDepth(91);
    const inner = this.scene.add
      .circle(this.layout.joystickCenterX, this.layout.joystickCenterY, Math.max(16, Math.round(this.layout.joystickRadius * 0.35)), 0x58f2e4, 0.78)
      .setStrokeStyle(1, 0x020408, 0.82)
      .setDepth(92);
    this.joystickBase = outer;
    this.joystickThumb = inner;
    this.overlay.add(outer);
    this.overlay.add(inner);
    this.updateJoystickThumb();
  }

  private createGameplayLookHint(): void {
    const hint = this.scene.add
      .text(this.layout.width * 0.69, this.layout.height - this.layout.bottomPad - this.layout.buttonSize * 2.4, 'ARRASTRA PARA MIRAR', {
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: '700',
        color: '#9ab6c4',
        backgroundColor: '#02040880',
        padding: { x: 6, y: 3 }
      })
      .setOrigin(0.5)
      .setDepth(90);
    this.overlay.add(hint);
  }

  private createUiPad(): void {
    const hint = this.scene.add
      .text(this.layout.width * 0.5, this.layout.height - this.layout.bottomPad - this.layout.buttonSize * 0.95, 'A confirmar · B volver · ↑↓ navegar · ←→ ajustar', {
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: '700',
        color: '#9ab6c4',
        backgroundColor: '#02040880',
        padding: { x: 6, y: 3 },
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(90);
    this.overlay.add(hint);
  }

  private applyModeVisibility(): void {
    const touchVisible = this.active;
    for (const button of this.buttons.values()) {
      const gameplayVisible = this.mode === 'gameplay' && !button.spec.gameplayOnly;
      const uiVisible = this.mode === 'ui';
      const visible = touchVisible && (gameplayVisible || uiVisible);
      button.rect.setVisible(visible);
      button.label.setVisible(visible);
    }
    for (const child of this.overlay) {
      if (isRaycastTouchTextObject(child) && child.text.includes('TOCA PARA ACTIVAR AUDIO')) {
        child.setVisible(touchVisible && !this.audioUnlocked && !this.layout.portraitPrompt);
      }
      if (isRaycastTouchTextObject(child) && child.text.includes('GIRA TU iPAD')) {
        child.setVisible(touchVisible && this.layout.portraitPrompt);
      }
    }
  }

  private updateButtonVisuals(): void {
    for (const button of this.buttons.values()) {
      const active = button.active;
      button.rect.setAlpha(active ? 0.82 : 0.38);
      button.label.setAlpha(active ? 1 : 0.5);
      if (button.pressed) {
        button.rect.setFillStyle(0x12313a, 0.95);
        button.rect.setStrokeStyle(2, 0xfff2bd, 0.9);
      } else {
        button.rect.setFillStyle(0x071018, 0.72);
        button.rect.setStrokeStyle(2, 0x6bf2d5, 0.5);
      }
    }
    this.updateJoystickThumb();
  }

  private showPortraitPrompt(visible: boolean): void {
    for (const child of this.overlay) {
      if (isRaycastTouchTextObject(child) && child.text.includes('GIRA TU iPAD')) {
        child.setVisible(visible);
      }
    }
  }

  private showAudioPrompt(visible: boolean): void {
    for (const child of this.overlay) {
      if (isRaycastTouchTextObject(child) && child.text.includes('TOCA PARA ACTIVAR AUDIO')) {
        child.setVisible(visible && !this.layout.portraitPrompt);
      }
    }
  }

  private computeJoystickVector(deadzone: number): MovementVector {
    const joystick = Array.from(this.activePointers.values()).find((pointer) => pointer.kind === 'joystick');
    if (!joystick) return { x: 0, y: 0 };
    return computeRaycastTouchJoystickVector(
      joystick.originX,
      joystick.originY,
      joystick.lastX,
      joystick.lastY,
      this.layout.joystickRadius,
      deadzone
    );
  }

  private unlockAudio(): void {
    if (this.audioUnlocked) return;
    const sound = this.scene.sound as { context?: AudioContext; unlock?: () => void } | undefined;
    const ctx = sound?.context;
    if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => undefined);
    if (typeof sound?.unlock === 'function') sound.unlock();
    this.audioUnlocked = true;
    this.showAudioPrompt(false);
  }

  private maybePreventDefault(pointer: Phaser.Input.Pointer, capturedOverlayGesture: boolean): void {
    if (!shouldRaycastTouchPreventDefault(this.mode, capturedOverlayGesture)) return;
    if (pointer.event && typeof pointer.event.preventDefault === 'function') pointer.event.preventDefault();
  }

  private releaseCapturedPointers(): void {
    const canvas = this.scene.game.canvas;
    for (const pointerId of this.activePointers.keys()) {
      try {
        canvas?.releasePointerCapture?.(pointerId);
      } catch {
        // Pointer may already be released after blur / Control Center.
      }
    }
    for (const pointer of this.scene.input.manager.pointers) {
      if (!isTouchLikePointer(pointer) || !pointer.isDown) continue;
      const target = (pointer.event as PointerEvent | undefined)?.target;
      if (target && 'releasePointerCapture' in target) {
        try {
          (target as Element).releasePointerCapture(pointer.id);
        } catch {
          // ignore
        }
      }
    }
  }

  private processPointerDown(pointer: Phaser.Input.Pointer): void {
    if (!isTouchLikePointer(pointer)) return;
    this.unlockAudio();
    if (!this.active || this.layout.portraitPrompt) return;

    const x = pointer.x;
    const y = pointer.y;
    const button = this.findButtonAt(x, y);
    if (button) {
      this.maybePreventDefault(pointer, true);
      this.activateButton(button, pointer.id);
      return;
    }

    if (!shouldRaycastTouchCaptureBackgroundPointer(this.mode, false)) return;

    this.maybePreventDefault(pointer, true);

    if (this.mode === 'gameplay') {
      if (this.isLikelyPalmRestTouch(x, y)) return;
      const leftZone = x <= this.layout.width * 0.34;
      if (leftZone) {
        if (this.countPointers('joystick') >= TOUCH_MAX_JOYSTICK_POINTERS) return;
        this.activePointers.set(pointer.id, {
          kind: 'joystick',
          pointerId: pointer.id,
          originX: x,
          originY: y,
          lastX: x,
          lastY: y
        });
        return;
      }
      if (this.countPointers('look') >= TOUCH_MAX_LOOK_POINTERS) return;
      this.activePointers.set(pointer.id, {
        kind: 'look',
        pointerId: pointer.id,
        originX: x,
        originY: y,
        lastX: x,
        lastY: y
      });
    }
  }

  private processPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!isTouchLikePointer(pointer)) return;
    if (!this.active || this.layout.portraitPrompt) return;
    const state = this.activePointers.get(pointer.id);
    if (!state) return;
    this.maybePreventDefault(pointer, true);
    if (state.kind === 'joystick') {
      state.lastX = pointer.x;
      state.lastY = pointer.y;
      this.currentMove = this.computeJoystickVector(this.getSettings().joystickDeadzone);
      this.updateJoystickThumb();
      return;
    }

    if (this.lookSuppressionFrames > 0) {
      state.lastX = pointer.x;
      state.lastY = pointer.y;
      this.currentLook = { x: 0, y: 0 };
      return;
    }

    const deltaX = pointer.x - state.lastX;
    const deltaY = pointer.y - state.lastY;
    state.lastX = pointer.x;
    state.lastY = pointer.y;
    if (Math.abs(deltaX) < TOUCH_MIN_LOOK_PIXEL_DELTA && Math.abs(deltaY) < TOUCH_MIN_LOOK_PIXEL_DELTA) {
      this.currentLook = { x: 0, y: 0 };
      return;
    }
    const sensitivity = this.getSettings().lookSensitivity;
    const clampPixels = (value: number): number => clamp(value, -TOUCH_MAX_LOOK_PIXEL_DELTA, TOUCH_MAX_LOOK_PIXEL_DELTA);
    this.queuedLook.x += clampRaycastTouchLookDelta(clampPixels(deltaX) * sensitivity * TOUCH_DEFAULT_LOOK_SENSITIVITY);
    this.queuedLook.y += clampRaycastTouchLookDelta(clampPixels(deltaY) * sensitivity * TOUCH_DEFAULT_LOOK_SENSITIVITY);
  }

  private processPointerUp(pointer: Phaser.Input.Pointer): void {
    const state = this.activePointers.get(pointer.id);
    if (!state) return;
    if (state.kind === 'button' && state.action) {
      const button = this.buttons.get(state.action);
      if (button) button.pressed = false;
    }
    this.activePointers.delete(pointer.id);
    this.recomputeTouchState();
  }

  private activateButton(button: TouchButtonState, pointerId: number): void {
    button.pressed = true;
    button.pointerId = pointerId;
    this.queuedPressedActions.add(button.action);
    this.heldActions.add(button.action);
    this.pushStatusMessage(this.buildActionMessage(button.action), 900);
    this.activePointers.set(pointerId, {
      kind: 'button',
      action: button.action,
      pointerId,
      originX: button.spec.x,
      originY: button.spec.y,
      lastX: button.spec.x,
      lastY: button.spec.y
    });
  }

  private findButtonAt(x: number, y: number): TouchButtonState | null {
    for (const button of this.buttons.values()) {
      if (!button.rect.visible) continue;
      if (containsButton(button, x, y)) return button;
    }
    return null;
  }

  private recomputeTouchState(): void {
    const joystick = Array.from(this.activePointers.values()).find((pointer) => pointer.kind === 'joystick');
    const hasLook = Array.from(this.activePointers.values()).some((pointer) => pointer.kind === 'look');
    this.currentMove =
      this.mode === 'gameplay' && joystick
        ? computeRaycastTouchJoystickVector(
            joystick.originX,
            joystick.originY,
            joystick.lastX,
            joystick.lastY,
            this.layout.joystickRadius,
            this.getSettings().joystickDeadzone
          )
        : { x: 0, y: 0 };
    if (!hasLook || this.mode !== 'gameplay') {
      this.currentLook = { x: 0, y: 0 };
      this.smoothedLookX = 0;
      this.queuedLook = { x: 0, y: 0 };
    }
    for (const button of this.buttons.values()) {
      if (button.pointerId === null) continue;
      const stillHeld = Array.from(this.activePointers.values()).some((pointer) => pointer.pointerId === button.pointerId);
      if (!stillHeld) {
        button.pointerId = null;
        button.pressed = false;
        this.heldActions.delete(button.action);
      }
    }
    this.updateJoystickThumb();
  }

  private updateJoystickThumb(): void {
    if (!this.joystickThumb || !this.joystickBase) return;
    const travel = this.layout.joystickRadius * 0.62;
    this.joystickThumb.setPosition(
      this.layout.joystickCenterX + this.currentMove.x * travel,
      this.layout.joystickCenterY + this.currentMove.y * travel
    );
    this.joystickThumb.setAlpha(this.active ? 0.92 : 0.45);
    this.joystickBase.setAlpha(this.active ? 0.55 : 0.3);
  }

  private buildActionMessage(action: RaycastTouchAction): string {
    switch (action) {
      case 'fire':
        return 'TOUCH: DISPARAR';
      case 'reload':
        return 'TOUCH: RECARGAR';
      case 'pause':
        return 'TOUCH: PAUSA';
      case 'toggleMap':
        return 'TOUCH: MINIMAPA';
      case 'weapon1':
        return 'TOUCH: ARMA 1';
      case 'weapon2':
        return 'TOUCH: ARMA 2';
      case 'weapon3':
        return 'TOUCH: ARMA 3';
      case 'confirm':
        return 'TOUCH: CONFIRMAR';
      case 'cancel':
        return 'TOUCH: VOLVER';
      case 'nextWeapon':
        return 'TOUCH: SIGUIENTE ARMA';
      case 'previousWeapon':
        return 'TOUCH: ARMA ANTERIOR';
      case 'navUp':
        return 'TOUCH: ARRIBA';
      case 'navDown':
        return 'TOUCH: ABAJO';
      case 'navLeft':
        return 'TOUCH: IZQUIERDA';
      case 'navRight':
        return 'TOUCH: DERECHA';
      default:
        return 'TOUCH: ACCIÓN';
    }
  }
}
