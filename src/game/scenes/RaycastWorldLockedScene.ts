import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from '../dimensions';
import { RAYCAST_CSS_WORLD2, RAYCAST_PALETTE } from '../raycast/RaycastPalette';
import { ensureSessionSettings, getGamepadDeadzone, getGamepadSensitivity, getGamepadVibrationEnabled } from '../sessionSettings';
import { RaycastGamepadInput } from '../systems/RaycastGamepadInput';

/** Pantalla de bloqueo cuando no está disponible el arco del Mundo 2. */
export class RaycastWorldLockedScene extends Phaser.Scene {
  private gamepadInput!: RaycastGamepadInput;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super('RaycastWorldLockedScene');
  }

  create(): void {
    ensureSessionSettings(this.registry);
    this.gamepadInput = new RaycastGamepadInput({
      getSettings: () => ({
        deadzone: getGamepadDeadzone(this.registry),
        lookSensitivity: getGamepadSensitivity(this.registry),
        vibrationEnabled: getGamepadVibrationEnabled(this.registry)
      })
    });
    this.cameras.main.setBackgroundColor(RAYCAST_PALETTE.voidBlack);

    this.add
      .text(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.38, 'ESTRATO ABISAL — SEÑAL AUSENTE', {
        fontFamily: 'monospace',
        fontSize: '22px',
        fontStyle: '700',
        color: RAYCAST_CSS_WORLD2.accentText,
        align: 'center'
      })
      .setOrigin(0.5);

    this.add
      .text(
        GAME_WIDTH * 0.5,
        GAME_HEIGHT * 0.52,
        'EL ARCO DE GRIETA DEL MUNDO 2 NO ESTÁ EN ESTA VERSIÓN — LLEGARÁ CUANDO SE INTEGRE EL PAQUETE DEL ESTRATO',
        {
          fontFamily: 'monospace',
          fontSize: '15px',
          fontStyle: '700',
          color: RAYCAST_CSS_WORLD2.bodyText,
          align: 'center',
          wordWrap: { width: GAME_WIDTH - 48 }
        }
      )
      .setOrigin(0.5);

    this.statusText = this.add
      .text(GAME_WIDTH * 0.5, GAME_HEIGHT * 0.72, 'Pulsa ESC o ENTER para ir al menú principal', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: RAYCAST_CSS_WORLD2.mutedText,
        align: 'center',
        wordWrap: { width: GAME_WIDTH - 64 }
      })
      .setOrigin(0.5);

    const kb = this.input.keyboard;
    const back = (): void => {
      this.scene.start('MenuScene');
    };
    kb?.once('keydown-ESC', back);
    kb?.once('keydown-ENTER', back);

    this.cameras.main.fadeIn(400, 0, 0, 0);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.gamepadInput?.destroy(), this);
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.gamepadInput?.destroy(), this);
  }

  update(): void {
    this.gamepadInput.update();
    this.statusText.setText(
      `${this.gamepadInput.isConnected() ? 'CONTROL · DETECTADO' : 'CONTROL · SIN CONTROL'}  |  A / START volver al menú  |  B cancelar`
    );
    if (this.gamepadInput.consumePressed('confirm') || this.gamepadInput.consumePressed('pause') || this.gamepadInput.consumePressed('cancel')) {
      this.scene.start('MenuScene');
    }
  }
}
