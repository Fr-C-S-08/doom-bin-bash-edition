import Phaser from 'phaser';
import { AudioFeedbackSystem } from '../systems/AudioFeedbackSystem';
import { RAYCAST_CSS, RAYCAST_PALETTE } from '../raycast/RaycastPalette';
import {
  ensureSessionSettings,
  getGamepadInvertY,
  getGamepadLeftDeadzone,
  getGamepadRightDeadzone,
  getGamepadSensitivity,
  getGamepadVibrationEnabled,
  getMinimapDefaultVisible,
  getMouseSensitivity,
  getScreenshakeEnabled,
  getSessionMasterVolume,
  setGamepadInvertY,
  setGamepadLeftDeadzone,
  setGamepadRightDeadzone,
  setGamepadSensitivity,
  setGamepadVibrationEnabled,
  setMinimapDefaultVisible,
  setMouseSensitivity,
  setScreenshakeEnabled,
  setSessionMasterVolume
} from '../sessionSettings';
import { RaycastGamepadInput } from '../systems/RaycastGamepadInput';

const BG = RAYCAST_PALETTE.voidBlack;
const ACCENT = RAYCAST_CSS.accentText;
const BODY = RAYCAST_CSS.bodyText;
const MUTED = RAYCAST_CSS.mutedText;

const ROW_KEYS = [
  'control',
  'mouse',
  'pad_sens',
  'pad_deadzone_left',
  'pad_deadzone_right',
  'invert_y',
  'pad_vibe',
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
  private rowIndex = 1;

  private readonly handleBack = (): void => {
    this.scene.start('MenuScene');
  };

  private readonly handleUp = (): void => {
    this.rowIndex = (this.rowIndex + ROW_KEYS.length - 1) % ROW_KEYS.length;
    if (ROW_KEYS[this.rowIndex] === 'control') this.rowIndex = (this.rowIndex + ROW_KEYS.length - 1) % ROW_KEYS.length;
    this.refreshBody();
  };

  private readonly handleDown = (): void => {
    this.rowIndex = (this.rowIndex + 1) % ROW_KEYS.length;
    if (ROW_KEYS[this.rowIndex] === 'control') this.rowIndex = (this.rowIndex + 1) % ROW_KEYS.length;
    this.refreshBody();
  };

  private readonly handleLeft = (): void => {
    this.adjustActive(-1);
  };

  private readonly handleRight = (): void => {
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
      } else {
        void this.scale.startFullscreen();
      }
      this.audioPreview.play('uiConfirm', 0.68, this.time.now);
      this.refreshBody();
    }
  };

  constructor() {
    super('SettingsScene');
  }

  create(): void {
    ensureSessionSettings(this.registry);
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
    if (this.gamepadInput.consumePressed('cancel') || this.gamepadInput.consumePressed('pause')) {
      this.handleBack();
      return;
    }
    if (this.gamepadInput.consumePressed('confirm')) {
      this.handleEnter();
      return;
    }
    if (this.gamepadInput.consumePressed('navUp')) this.handleUp();
    if (this.gamepadInput.consumePressed('navDown')) this.handleDown();
    if (this.gamepadInput.consumePressed('navLeft') || this.gamepadInput.consumePressed('previousWeapon')) this.handleLeft();
    if (this.gamepadInput.consumePressed('navRight') || this.gamepadInput.consumePressed('nextWeapon')) this.handleRight();
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
    const padDeadzoneLeft = getGamepadLeftDeadzone(this.registry).toFixed(2);
    const padDeadzoneRight = getGamepadRightDeadzone(this.registry).toFixed(2);
    const invertY = getGamepadInvertY(this.registry) ? 'SÍ' : 'NO';
    const padVibe = getGamepadVibrationEnabled(this.registry) ? 'SÍ' : 'NO';
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
    label('pad_deadzone_left', `MANDO · deadzone izq ${padDeadzoneLeft}`);
    label('pad_deadzone_right', `MANDO · deadzone der ${padDeadzoneRight}`);
    label('invert_y', `MANDO · invertir eje Y ${invertY}`);
    label('pad_vibe', `MANDO · vibración ${padVibe}`);
    label('vol', `AUDIO · volumen maestro ${vol}%`);
    label('shake', `PANTALLA · screenshake ${shake}`);
    label('minimap', `MINIMAPA · visible al iniciar ${mini}`);
    label('fullscreen', `PANTALLA COMPLETA · ${fs}`);
    label('back', 'VOLVER AL MENÚ ← ENTER / ESC');

    this.bodyText.setText(['Ajustes aplican a esta sesión únicamente.', '', ...rows].join('\n'));
  }
}
