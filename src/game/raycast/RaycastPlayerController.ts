import Phaser from 'phaser';
import type { RaycastMap } from './RaycastMap';
import type { RaycastGamepadInput } from '../systems/RaycastGamepadInput';
import type { RaycastTouchInput } from '../systems/RaycastTouchInput';
import {
  applyRaycastMouseTurn,
  getCameraRelativeInput,
  moveWithWallSlide,
  RAYCAST_MOVEMENT,
  updateRaycastVelocity,
  type RaycastMovementConfig
} from './RaycastMovement';
import type { MovementVector } from '../systems/MovementSystem';

export interface RaycastPlayerState {
  x: number;
  y: number;
  angle: number;
  velocity: MovementVector;
}

export class RaycastPlayerController {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keys!: Record<string, Phaser.Input.Keyboard.Key>;
  private pointerListenersRegistered = false;
  private browserLookGuardsRegistered = false;
  private moveSpeedMultiplier = 1;
  private lookSuppressionFrames = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly map: RaycastMap,
    private readonly state: RaycastPlayerState,
    private readonly config: RaycastMovementConfig = RAYCAST_MOVEMENT,
  private readonly getMouseSensitivityMul?: () => number,
  private readonly gamepadInput?: RaycastGamepadInput,
  private readonly touchInput?: RaycastTouchInput,
  private readonly isLookCaptureAllowed?: () => boolean
  ) {}

  create(): void {
    this.cursors = this.scene.input.keyboard!.createCursorKeys();
    this.keys = this.scene.input.keyboard!.addKeys('W,A,S,D,Q,E') as Record<string, Phaser.Input.Keyboard.Key>;
    this.registerPointerControls();
    this.registerBrowserLookGuards();
  }

  update(deltaMs: number): void {
    const moveConfig =
      this.moveSpeedMultiplier === 1
        ? this.config
        : {
            ...this.config,
            maxSpeed: this.config.maxSpeed * this.moveSpeedMultiplier,
            forwardSpeed: this.config.forwardSpeed * this.moveSpeedMultiplier,
            backwardSpeed: this.config.backwardSpeed * this.moveSpeedMultiplier,
            strafeSpeed: this.config.strafeSpeed * this.moveSpeedMultiplier
          };
    const deltaSeconds = deltaMs / 1000;
    const gamepadMove = this.gamepadInput?.getMoveInput() ?? { x: 0, y: 0 };
    const gamepadLook = this.lookSuppressionFrames > 0 ? { x: 0, y: 0 } : this.gamepadInput?.getLookInput() ?? { x: 0, y: 0 };
    const touchMove = this.touchInput?.getMoveInput() ?? { x: 0, y: 0 };
    const touchLook = this.lookSuppressionFrames > 0 ? { x: 0, y: 0 } : this.touchInput?.getLookInput() ?? { x: 0, y: 0 };
    const turnInput =
      Number(this.cursors.right.isDown || this.keys.E.isDown) -
      Number(this.cursors.left.isDown || this.keys.Q.isDown) +
      gamepadLook.x +
      touchLook.x;
    this.state.angle += Phaser.Math.Clamp(turnInput, -1, 1) * moveConfig.turnSpeed * deltaSeconds;

    const forwardInput = Number(this.keys.W.isDown) - Number(this.keys.S.isDown) + gamepadMove.y + touchMove.y;
    const strafeInput = Number(this.keys.D.isDown) - Number(this.keys.A.isDown) + gamepadMove.x + touchMove.x;
    const movementInput = getCameraRelativeInput(forwardInput, strafeInput, this.state.angle, moveConfig);
    this.state.velocity = updateRaycastVelocity(this.state.velocity, movementInput, deltaMs, moveConfig);
    const movedState = moveWithWallSlide(this.map, this.state, deltaMs, moveConfig);

    this.state.x = movedState.x;
    this.state.y = movedState.y;
    this.state.velocity = movedState.velocity;
    if (this.lookSuppressionFrames > 0) this.lookSuppressionFrames -= 1;
  }

  destroy(): void {
    this.cleanupPointerControls();
    this.cleanupBrowserLookGuards();
  }

  setMoveSpeedMultiplier(multiplier: number): void {
    this.moveSpeedMultiplier = Number.isFinite(multiplier) ? Math.max(0.6, multiplier) : 1;
  }

  suppressLookInput(frames = 2): void {
    const safeFrames = Math.max(1, Math.floor(frames));
    this.lookSuppressionFrames = Math.max(this.lookSuppressionFrames, safeFrames);
  }

  private readonly handlePointerDown = (): void => {
    if (this.isLookCaptureAllowed && !this.isLookCaptureAllowed()) return;
    const canvas = this.scene.game.canvas;
    if (document.pointerLockElement === canvas) return;
    canvas.requestPointerLock();
  };

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.isLookCaptureAllowed && !this.isLookCaptureAllowed()) return;
    if (document.pointerLockElement !== this.scene.game.canvas) return;
    if (this.lookSuppressionFrames > 0) return;
    const mul = this.getMouseSensitivityMul?.() ?? 1;
    this.state.angle = applyRaycastMouseTurn(this.state.angle, pointer.movementX, {
      ...this.config,
      mouseTurnSensitivity: this.config.mouseTurnSensitivity * mul
    });
  };

  private readonly handleWindowBlur = (): void => {
    this.suppressLookInput(2);
  };

  private readonly handleWindowFocus = (): void => {
    this.suppressLookInput(2);
  };

  private readonly handlePointerLockChange = (): void => {
    this.suppressLookInput(2);
  };

  private registerPointerControls(): void {
    if (this.pointerListenersRegistered) this.cleanupPointerControls();
    this.scene.input.on('pointerdown', this.handlePointerDown);
    this.scene.input.on('pointermove', this.handlePointerMove);
    this.pointerListenersRegistered = true;
  }

  private cleanupPointerControls(): void {
    if (!this.pointerListenersRegistered) return;
    this.scene.input.off('pointerdown', this.handlePointerDown);
    this.scene.input.off('pointermove', this.handlePointerMove);
    this.pointerListenersRegistered = false;
  }

  private registerBrowserLookGuards(): void {
    if (this.browserLookGuardsRegistered) this.cleanupBrowserLookGuards();
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('focus', this.handleWindowFocus);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    this.browserLookGuardsRegistered = true;
  }

  private cleanupBrowserLookGuards(): void {
    if (!this.browserLookGuardsRegistered || typeof window === 'undefined' || typeof document === 'undefined') return;
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('focus', this.handleWindowFocus);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    this.browserLookGuardsRegistered = false;
  }
}
