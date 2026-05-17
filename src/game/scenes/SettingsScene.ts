import Phaser from 'phaser';
import { AudioFeedbackSystem } from '../systems/AudioFeedbackSystem';
import { RAYCAST_CSS, RAYCAST_PALETTE } from '../raycast/RaycastPalette';
import { prepareGameSession, setPreferFullscreenSaved } from '../save/persistSessionSettings';
import { formatAimAssistLabel } from '../raycast/RaycastLookFeel';
import {
  formatRaycastActiveInputLine,
  formatRaycastControlsHelpBlock,
  resolveRaycastActiveInput,
  type RaycastActiveInputKind,
  type RaycastActiveInputSnapshot
} from '../raycast/RaycastInputHelp';
import {
  cycleAimAssistSetting,
  getAimAssistLevel,
  getCameraSmoothing,
  getGamepadInvertY,
  getGamepadLeftDeadzone,
  getGamepadRightDeadzone,
  getGamepadSensitivity,
  getGamepadVibrationEnabled,
  getMinimapDefaultVisible,
  getMouseSensitivity,
  getScreenshakeEnabled,
  getSessionMasterVolume,
  getTouchButtonScale,
  getTouchControlsEnabled,
  getTouchJoystickDeadzone,
  getTouchLookSensitivity,
  setCameraSmoothing,
  setGamepadInvertY,
  setGamepadLeftDeadzone,
  setGamepadRightDeadzone,
  setGamepadSensitivity,
  setGamepadVibrationEnabled,
  setMinimapDefaultVisible,
  setMouseSensitivity,
  setScreenshakeEnabled,
  setTouchButtonScale,
  setTouchControlsEnabled,
  setTouchJoystickDeadzone,
  setTouchLookSensitivity,
  setSessionMasterVolume
} from '../sessionSettings';
import { RaycastGamepadInput } from '../systems/RaycastGamepadInput';
import { RaycastTouchInput } from '../systems/RaycastTouchInput';

const BG = RAYCAST_PALETTE.voidBlack;
const ACCENT = RAYCAST_CSS.accentText;
const BODY = RAYCAST_CSS.bodyText;
const MUTED = RAYCAST_CSS.mutedText;

const ROW_KEYS = [
  'control',
  'mouse',
  'pad_sens',
  'aim_assist',
  'camera_smooth',
  'pad_deadzone_left',
  'pad_deadzone_right',
  'invert_y',
  'pad_vibe',
  'touch_controls',
  'touch_sens',
  'touch_button_scale',
  'touch_deadzone',
  'vol',
  'shake',
  'minimap',
  'fullscreen',
  'back'
] as const;
type SettingRow = (typeof ROW_KEYS)[number];

export class SettingsScene extends Phaser.Scene {
  private bodyText!: Phaser.GameObjects.Text;
  private audioPreview!: AudioFeedbackSystem;
  private gamepadInput!: RaycastGamepadInput;
  private touchInput!: RaycastTouchInput;
  private rowIndex = 1;
  private detectedActiveInputKind: RaycastActiveInputKind = 'keyboard_mouse';

  private readonly handleBack = (): void => {
    this.scene.start('MenuScene');
  };

  private getActiveInputSnapshot(): RaycastActiveInputSnapshot {
    return {
      gamepadConnected: this.gamepadInput.isConnected(),
      touchActive: this.touchInput.isActive(),
      touchControlsEnabled: getTouchControlsEnabled(this.registry)
    };
  }

  private resolveSettingsActiveInput(): RaycastActiveInputKind {
    return resolveRaycastActiveInput(this.getActiveInputSnapshot(), this.detectedActiveInputKind);
  }

  private markDetectedActiveInput(kind: RaycastActiveInputKind): void {
    this.detectedActiveInputKind = kind;
  }

  private trackSettingsInputActivity(): void {
    if (this.touchInput.isActive()) {
      this.markDetectedActiveInput('touch');
      return;
    }
    if (this.gamepadInput.isConnected()) {
      const move = this.gamepadInput.getMoveInput();
      const look = this.gamepadInput.getLookInput();
      if (Math.hypot(move.x, move.y, look.x, look.y) > 0.14) {
        this.markDetectedActiveInput('gamepad');
      }
    }
  }

  private readonly handleUp = (): void => {
    this.markDetectedActiveInput('keyboard_mouse');
    this.rowIndex = (this.rowIndex + ROW_KEYS.length - 1) % ROW_KEYS.length;
    if (ROW_KEYS[this.rowIndex] === 'control') this.rowIndex = (this.rowIndex + ROW_KEYS.length - 1) % ROW_KEYS.length;
    this.refreshBody();
  };

  private readonly handleDown = (): void => {
    this.markDetectedActiveInput('keyboard_mouse');
    this.rowIndex = (this.rowIndex + 1) % ROW_KEYS.length;
    if (ROW_KEYS[this.rowIndex] === 'control') this.rowIndex = (this.rowIndex + 1) % ROW_KEYS.length;
    this.refreshBody();
  };

  private readonly handleLeft = (): void => {
    this.markDetectedActiveInput('keyboard_mouse');
    this.adjustActive(-1);
  };

  private readonly handleRight = (): void => {
    this.markDetectedActiveInput('keyboard_mouse');
    this.adjustActive(1);
  };

  private readonly handleEnter = (): void => {
    if (ROW_KEYS[this.rowIndex] === 'back') {
      this.handleBack();
      return;
    }
    if (ROW_KEYS[this.rowIndex] === 'fullscreen') {
      if (this.scale.isFullscreen) {
        this.scale.stopFullscreen();
        setPreferFullscreenSaved(false);
      } else {
        void this.scale.startFullscreen();
        setPreferFullscreenSaved(true);
      }
      this.audioPreview.play('uiConfirm', 0.68, this.time.now);
      this.refreshBody();
    }
  };

  constructor() {
    super('SettingsScene');
  }

  create(): void {
    prepareGameSession(this.registry);
    const width = this.scale.width;
    const height = this.scale.height;
    this.audioPreview = new AudioFeedbackSystem();
    this.audioPreview.setMasterVolume(getSessionMasterVolume(this.registry));
    this.gamepadInput = new RaycastGamepadInput({
      getSettings: () => ({
        leftDeadzone: getGamepadLeftDeadzone(this.registry),
        rightDeadzone: getGamepadRightDeadzone(this.registry),
        lookSensitivity: getGamepadSensitivity(this.registry),
        invertLookY: getGamepadInvertY(this.registry),
        vibrationEnabled: getGamepadVibrationEnabled(this.registry)
      })
    });
    this.touchInput = new RaycastTouchInput(this, {
      mode: 'ui',
      getSettings: () => ({
        enabled: getTouchControlsEnabled(this.registry),
        buttonScale: getTouchButtonScale(this.registry),
        lookSensitivity: getTouchLookSensitivity(this.registry),
        joystickDeadzone: getTouchJoystickDeadzone(this.registry)
      })
    });

    this.cameras.main.setBackgroundColor(BG);
    const backdrop = this.add.graphics().setDepth(0);
    backdrop.fillGradientStyle(0x020408, 0x020408, 0x070b12, 0x03050a, 1);
    backdrop.fillRect(0, 0, width, height);
    backdrop.lineStyle(1, 0x1a2430, 0.25);
    for (let y = 0; y < height; y += 7) {
      backdrop.lineBetween(0, y, width, y);
    }

    this.add
      .text(width * 0.5, 36, '// CONFIGURACIÓN · SESIÓN', {
        fontFamily: 'monospace',
        fontSize: width <= 720 ? '17px' : '22px',
        fontStyle: '700',
        color: ACCENT,
        align: 'center'
      })
      .setOrigin(0.5, 0)
      .setDepth(3);

    const wrap = Math.min(width - 32, 720);
    this.bodyText = this.add
      .text(width * 0.5, 92, '', {
        fontFamily: 'monospace',
        fontSize: width <= 720 ? '12px' : '14px',
        fontStyle: '700',
        color: BODY,
        align: 'left',
        lineSpacing: 6,
        wordWrap: { width: wrap }
      })
      .setOrigin(0.5, 0)
      .setDepth(4);

    this.add
      .text(width * 0.5, height - 20, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: MUTED,
        align: 'center'
      })
      .setOrigin(0.5, 1)
      .setDepth(3)
      .setAlpha(0.75)
      .setText('↑ / ↓ · fila   ← / → · ajustar   A / ENTER · confirmar   B / Start / ESC · volver')
      .setWordWrapWidth(width - 48, true);

    this.refreshBody();
    this.cameras.main.fadeIn(420, 0, 0, 0);
    this.touchInput.create();

    const kb = this.input.keyboard;
    kb?.on('keydown-ESC', this.handleBack);
    kb?.on('keydown-UP', this.handleUp);
    kb?.on('keydown-DOWN', this.handleDown);
    kb?.on('keydown-LEFT', this.handleLeft);
    kb?.on('keydown-RIGHT', this.handleRight);
    kb?.on('keydown-ENTER', this.handleEnter);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanup, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanup, this);
  }

  update(): void {
    this.gamepadInput.update();
    this.touchInput.update();
    this.trackSettingsInputActivity();
    if (
      this.gamepadInput.consumePressed('navUp') ||
      this.gamepadInput.consumePressed('navDown') ||
      this.gamepadInput.consumePressed('navLeft') ||
      this.gamepadInput.consumePressed('navRight') ||
      this.gamepadInput.consumePressed('confirm') ||
      this.gamepadInput.consumePressed('cancel')
    ) {
      this.markDetectedActiveInput('gamepad');
    }
    if (
      this.touchInput.consumePressed('navUp') ||
      this.touchInput.consumePressed('navDown') ||
      this.touchInput.consumePressed('navLeft') ||
      this.touchInput.consumePressed('navRight') ||
      this.touchInput.consumePressed('confirm') ||
      this.touchInput.consumePressed('cancel')
    ) {
      this.markDetectedActiveInput('touch');
    }
    if (this.gamepadInput.consumePressed('cancel') || this.gamepadInput.consumePressed('pause')) {
      this.handleBack();
      return;
    }
    if (this.touchInput.consumePressed('cancel') || this.touchInput.consumePressed('pause')) {
      this.handleBack();
      return;
    }
    if (this.gamepadInput.consumePressed('confirm')) {
      this.handleEnter();
      return;
    }
    if (this.touchInput.consumePressed('confirm')) {
      this.handleEnter();
      return;
    }
    if (this.gamepadInput.consumePressed('navUp')) this.handleUp();
    if (this.gamepadInput.consumePressed('navDown')) this.handleDown();
    if (this.gamepadInput.consumePressed('navLeft') || this.gamepadInput.consumePressed('previousWeapon')) this.handleLeft();
    if (this.gamepadInput.consumePressed('navRight') || this.gamepadInput.consumePressed('nextWeapon')) this.handleRight();
    if (this.touchInput.consumePressed('navUp')) this.handleUp();
    if (this.touchInput.consumePressed('navDown')) this.handleDown();
    if (this.touchInput.consumePressed('navLeft') || this.touchInput.consumePressed('previousWeapon')) this.handleLeft();
    if (this.touchInput.consumePressed('navRight') || this.touchInput.consumePressed('nextWeapon')) this.handleRight();
    this.refreshBody();
  }

  private cleanup(): void {
    const kb = this.input.keyboard;
    kb?.off('keydown-ESC', this.handleBack);
    kb?.off('keydown-UP', this.handleUp);
    kb?.off('keydown-DOWN', this.handleDown);
    kb?.off('keydown-LEFT', this.handleLeft);
    kb?.off('keydown-RIGHT', this.handleRight);
    kb?.off('keydown-ENTER', this.handleEnter);
    this.gamepadInput?.destroy();
    this.touchInput?.destroy();
  }

  private adjustActive(direction: number): void {
    const row = ROW_KEYS[this.rowIndex];
    if (row === 'mouse') {
      const next = Math.round((getMouseSensitivity(this.registry) + direction * 0.05) * 100) / 100;
      setMouseSensitivity(this.registry, next);
      this.audioPreview.play('uiSoftDeny', 0.55, this.time.now);
    } else if (row === 'pad_sens') {
      const next = Math.round((getGamepadSensitivity(this.registry) + direction * 0.05) * 100) / 100;
      setGamepadSensitivity(this.registry, next);
      this.audioPreview.play('uiConfirm', 0.62, this.time.now);
    } else if (row === 'aim_assist') {
      cycleAimAssistSetting(this.registry, direction);
      this.audioPreview.play('difficultySelect', 0.75, this.time.now);
    } else if (row === 'camera_smooth') {
      const next = Math.round((getCameraSmoothing(this.registry) + direction * 0.05) * 100) / 100;
      setCameraSmoothing(this.registry, next);
      this.audioPreview.play('uiConfirm', 0.62, this.time.now);
    } else if (row === 'pad_deadzone_left') {
      const next = Math.round((getGamepadLeftDeadzone(this.registry) + direction * 0.01) * 100) / 100;
      setGamepadLeftDeadzone(this.registry, next);
      this.audioPreview.play('uiConfirm', 0.62, this.time.now);
    } else if (row === 'pad_deadzone_right') {
      const next = Math.round((getGamepadRightDeadzone(this.registry) + direction * 0.01) * 100) / 100;
      setGamepadRightDeadzone(this.registry, next);
      this.audioPreview.play('uiConfirm', 0.62, this.time.now);
    } else if (row === 'invert_y') {
      setGamepadInvertY(this.registry, !getGamepadInvertY(this.registry));
      this.audioPreview.play('uiConfirm', 0.62, this.time.now);
    } else if (row === 'pad_vibe') {
      setGamepadVibrationEnabled(this.registry, direction > 0);
      this.audioPreview.play('difficultySelect', 0.75, this.time.now);
    } else if (row === 'touch_controls') {
      setTouchControlsEnabled(this.registry, direction > 0);
      this.audioPreview.play('difficultySelect', 0.75, this.time.now);
    } else if (row === 'touch_sens') {
      const next = Math.round((getTouchLookSensitivity(this.registry) + direction * 0.05) * 100) / 100;
      setTouchLookSensitivity(this.registry, next);
      this.audioPreview.play('uiConfirm', 0.62, this.time.now);
    } else if (row === 'touch_button_scale') {
      const next = Math.round((getTouchButtonScale(this.registry) + direction * 0.05) * 100) / 100;
      setTouchButtonScale(this.registry, next);
      this.audioPreview.play('uiConfirm', 0.62, this.time.now);
    } else if (row === 'touch_deadzone') {
      const next = Math.round((getTouchJoystickDeadzone(this.registry) + direction * 0.01) * 100) / 100;
      setTouchJoystickDeadzone(this.registry, next);
      this.audioPreview.play('uiConfirm', 0.62, this.time.now);
    } else if (row === 'vol') {
      const next = Math.round((getSessionMasterVolume(this.registry) + direction * 0.05) * 100) / 100;
      setSessionMasterVolume(this.registry, next);
      this.audioPreview.setMasterVolume(getSessionMasterVolume(this.registry));
      this.audioPreview.play('uiConfirm', 0.62, this.time.now);
    } else if (row === 'shake') {
      setScreenshakeEnabled(this.registry, direction > 0);
      this.audioPreview.play('difficultySelect', 0.75, this.time.now);
    } else if (row === 'minimap') {
      setMinimapDefaultVisible(this.registry, direction > 0);
      this.audioPreview.play('difficultySelect', 0.75, this.time.now);
    } else {
      return;
    }
    this.refreshBody();
  }

  private refreshBody(): void {
    const sens = getMouseSensitivity(this.registry).toFixed(2);
    const padSens = getGamepadSensitivity(this.registry).toFixed(2);
    const aimAssist = formatAimAssistLabel(getAimAssistLevel(this.registry));
    const cameraSmooth = getCameraSmoothing(this.registry).toFixed(2);
    const padDeadzoneLeft = getGamepadLeftDeadzone(this.registry).toFixed(2);
    const padDeadzoneRight = getGamepadRightDeadzone(this.registry).toFixed(2);
    const invertY = getGamepadInvertY(this.registry) ? 'SÍ' : 'NO';
    const padVibe = getGamepadVibrationEnabled(this.registry) ? 'SÍ' : 'NO';
    const touchControls = getTouchControlsEnabled(this.registry) ? 'SÍ' : 'NO';
    const touchSens = getTouchLookSensitivity(this.registry).toFixed(2);
    const touchButtonScale = getTouchButtonScale(this.registry).toFixed(2);
    const touchDeadzone = getTouchJoystickDeadzone(this.registry).toFixed(2);
    const controlStatus = this.gamepadInput.isConnected() ? 'DETECTADO' : 'SIN CONTROL';
    const vol = Math.round(getSessionMasterVolume(this.registry) * 100);
    const shake = getScreenshakeEnabled(this.registry) ? 'SÍ' : 'NO';
    const mini = getMinimapDefaultVisible(this.registry) ? 'SÍ' : 'NO';
    const fs = this.scale.isFullscreen ? 'ACTIVO' : 'VENTANA';
    const rows: string[] = [];
    const label = (key: SettingRow, line: string) => {
      const i = ROW_KEYS.indexOf(key);
      const mark = i === this.rowIndex ? '>' : ' ';
      rows.push(`${mark} ${line}`);
    };
    label('control', `CONTROL · ${controlStatus}`);
    label('mouse', `RATÓN · sensibilidad ×${sens}`);
    label('pad_sens', `MANDO · sensibilidad ×${padSens}`);
    label('aim_assist', `APUNTADO · asistencia ${aimAssist}`);
    label('camera_smooth', `CÁMARA · suavizado ${cameraSmooth}`);
    label('pad_deadzone_left', `MANDO · deadzone izq ${padDeadzoneLeft}`);
    label('pad_deadzone_right', `MANDO · deadzone der ${padDeadzoneRight}`);
    label('invert_y', `MANDO · invertir eje Y ${invertY}`);
    label('pad_vibe', `MANDO · vibración ${padVibe}`);
    label('touch_controls', `TOQUE · controles ${touchControls}`);
    label('touch_sens', `TOQUE · sensibilidad ${touchSens}`);
    label('touch_button_scale', `TOQUE · tamaño botones ${touchButtonScale}`);
    label('touch_deadzone', `TOQUE · deadzone joystick ${touchDeadzone}`);
    label('vol', `AUDIO · volumen maestro ${vol}%`);
    label('shake', `PANTALLA · screenshake ${shake}`);
    label('minimap', `MINIMAPA · visible al iniciar ${mini}`);
    label('fullscreen', `PANTALLA COMPLETA · ${fs}`);
    label('back', 'VOLVER AL MENÚ ← ENTER / ESC');

    const activeInput = this.resolveSettingsActiveInput();
    this.bodyText.setText(
      [
        'Ajustes guardados en este dispositivo.',
        formatRaycastActiveInputLine(activeInput),
        '',
        'CONTROLES',
        formatRaycastControlsHelpBlock(activeInput),
        '',
        ...rows
      ].join('\n')
    );
  }
}
