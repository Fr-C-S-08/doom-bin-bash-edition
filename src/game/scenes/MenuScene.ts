import Phaser from 'phaser';
import { AudioFeedbackSystem } from '../systems/AudioFeedbackSystem';
import { getRaycastFeedbackActions } from '../raycast/RaycastFeedback';
import {
  cycleRaycastDifficulty,
  getRaycastDifficultyPreset,
  RAYCAST_DIFFICULTY_REGISTRY_KEY
} from '../raycast/RaycastDifficulty';
import { buildMainMenuLayout, getMainMenuCopy } from '../raycast/RaycastPresentation';
import { RAYCAST_CSS, RAYCAST_PALETTE } from '../raycast/RaycastPalette';
import { createEmptyCampaignMetrics } from '../raycast/RaycastScore';
import { prepareGameSession } from '../save/persistSessionSettings';
import {
  getGamepadInvertY,
  getGamepadLeftDeadzone,
  getGamepadRightDeadzone,
  getGamepadSensitivity,
  getGamepadVibrationEnabled,
  getTouchButtonScale,
  getTouchControlsEnabled,
  getTouchJoystickDeadzone,
  getTouchLookSensitivity
} from '../sessionSettings';
import { getRaycastBossLevelId, type RaycastBossShortcutSlot } from '../raycast/RaycastBossShortcuts';
import { RaycastGamepadInput } from '../systems/RaycastGamepadInput';
import { RaycastTouchInput } from '../systems/RaycastTouchInput';

const MENU_BACKGROUND = RAYCAST_PALETTE.voidBlack;
const MENU_CYAN = RAYCAST_PALETTE.plasmaBright;
const MENU_CYAN_SOFT = RAYCAST_CSS.accentText;
const MENU_EMBER = RAYCAST_PALETTE.amberWarn;
const MENU_ROSE = RAYCAST_PALETTE.telegraphRose;
const MENU_SETTINGS = '#f06f9a';

export class MenuScene extends Phaser.Scene {
  private inputListenersRegistered = false;
  private audioFeedback!: AudioFeedbackSystem;
  private difficultyHintText!: Phaser.GameObjects.Text;
  private gamepadStatusText!: Phaser.GameObjects.Text;
  private gamepadInput!: RaycastGamepadInput;
  private touchInput!: RaycastTouchInput;
  private menuSelectionIndex = 0;
  private startLine!: Phaser.GameObjects.Text;
  private settingsLine!: Phaser.GameObjects.Text;

  private readonly handleStartRaycast = (): void => {
    this.playFeedbackEvent('difficultyStart');
    const difficultyId = getRaycastDifficultyPreset(this.registry.get(RAYCAST_DIFFICULTY_REGISTRY_KEY)).id;
    this.scene.start('PrologueScene', { difficultyId });
  };

  private startRaycastBoss(slot: RaycastBossShortcutSlot): void {
    const difficultyId = getRaycastDifficultyPreset(this.registry.get(RAYCAST_DIFFICULTY_REGISTRY_KEY)).id;
    this.scene.start('RaycastScene', {
      levelId: getRaycastBossLevelId(slot),
      difficultyId,
      carryScore: 0,
      carryCampaignMetrics: createEmptyCampaignMetrics(),
      rewardTier: 0,
      runModifierId: null
    });
  }

  private readonly handleBossMenuOne = (): void => {
    this.startRaycastBoss(1);
  };

  private readonly handleBossMenuTwo = (): void => {
    this.startRaycastBoss(2);
  };

  private readonly handleBossMenuThree = (): void => {
    this.startRaycastBoss(3);
  };

  private readonly handleOpenSettings = (): void => {
    this.scene.start('SettingsScene');
  };

  private readonly handleMenuSelectionUp = (): void => {
    this.menuSelectionIndex = (this.menuSelectionIndex + 2 - 1) % 2;
    this.refreshMenuSelectionVisuals();
  };

  private readonly handleMenuSelectionDown = (): void => {
    this.menuSelectionIndex = (this.menuSelectionIndex + 1) % 2;
    this.refreshMenuSelectionVisuals();
  };

  private readonly handleMenuConfirm = (): void => {
    if (this.menuSelectionIndex === 0) {
      this.handleStartRaycast();
      return;
    }
    this.handleOpenSettings();
  };

  private readonly handleMenuCancel = (): void => {
    this.menuSelectionIndex = 0;
    this.refreshMenuSelectionVisuals();
  };

  private readonly handleCycleDifficulty = (): void => {
    const next = cycleRaycastDifficulty(this.registry.get(RAYCAST_DIFFICULTY_REGISTRY_KEY));
    this.registry.set(RAYCAST_DIFFICULTY_REGISTRY_KEY, next.id);
    this.difficultyHintText.setText(this.buildDifficultyMenuLine());
    this.playFeedbackEvent('difficultySelect');
  };

  private buildDifficultyMenuLine(): string {
    const preset = getRaycastDifficultyPreset(this.registry.get(RAYCAST_DIFFICULTY_REGISTRY_KEY));
    return `DIFFICULTY · ${preset.label.toUpperCase()}  ·  [D] CYCLE`;
  }

  constructor() {
    super('MenuScene');
  }

  create(): void {
    prepareGameSession(this.registry);
    const width = this.scale.width;
    const height = this.scale.height;
    const copy = getMainMenuCopy();
    const layout = buildMainMenuLayout(width, height);
    this.audioFeedback = new AudioFeedbackSystem();
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

    this.cameras.main.setBackgroundColor(MENU_BACKGROUND);

    this.drawBackdrop(width, height);
    this.drawTitleFrame(width, height, layout.titleFrameCenterY);

    this.add
      .text(layout.centerX, layout.titleY, copy.title, {
        fontFamily: 'monospace',
        fontSize: width <= 720 ? '22px' : '34px',
        fontStyle: '700',
        color: MENU_CYAN_SOFT,
        stroke: '#05070b',
        strokeThickness: 6,
        align: 'center',
        wordWrap: { width: width - 48 }
      })
      .setOrigin(0.5)
      .setDepth(8);

    this.add
      .text(layout.centerX, layout.subtitleY, copy.subtitle, {
        fontFamily: 'monospace',
        fontSize: width <= 720 ? '11px' : '13px',
        fontStyle: '700',
        color: '#9aa8bc',
        align: 'center',
        wordWrap: { width: width - 48 }
      })
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.9);

    this.startLine = this.add
      .text(layout.centerX, layout.option3dY, copy.press3d, {
        fontFamily: 'monospace',
        fontSize: '17px',
        fontStyle: '700',
        color: MENU_CYAN_SOFT,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(8)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_DOWN, this.handleStartRaycast);

    this.startLine.on(Phaser.Input.Events.POINTER_OVER, () => {
      this.menuSelectionIndex = 0;
      this.refreshMenuSelectionVisuals();
    });
    this.startLine.on(Phaser.Input.Events.POINTER_OUT, () => this.refreshMenuSelectionVisuals());

    this.settingsLine = this.add
      .text(layout.centerX, layout.settingsY, copy.settingsPrompt, {
        fontFamily: 'monospace',
        fontSize: '13px',
        fontStyle: '700',
        color: MENU_SETTINGS,
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.92)
      .setInteractive({ useHandCursor: true })
      .on(Phaser.Input.Events.POINTER_DOWN, this.handleOpenSettings);
    this.settingsLine.on(Phaser.Input.Events.POINTER_OVER, () => {
      this.menuSelectionIndex = 1;
      this.refreshMenuSelectionVisuals();
    });
    this.settingsLine.on(Phaser.Input.Events.POINTER_OUT, () => this.refreshMenuSelectionVisuals());

    this.gamepadStatusText = this.add
      .text(layout.centerX, layout.settingsY + 28, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        fontStyle: '700',
        color: '#9ef0cf',
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.82);

    const shortFooter = width <= 720 || height <= 405;
    const footerFontSize = shortFooter ? '9px' : '10px';

    this.add
      .text(layout.centerX, layout.footerCreditY, copy.footerCredit, {
        fontFamily: 'monospace',
        fontSize: footerFontSize,
        fontStyle: '700',
        color: '#6d7d90',
        align: 'center',
        letterSpacing: 0.6,
        wordWrap: { width: layout.footerMaxWidth }
      })
      .setOrigin(0.5, 1)
      .setDepth(8)
      .setAlpha(0.78);

    this.add
      .text(layout.centerX, layout.footerHintsY, copy.footerInputHints, {
        fontFamily: 'monospace',
        fontSize: footerFontSize,
        fontStyle: '700',
        color: '#5c6a7c',
        align: 'center',
        letterSpacing: 0.35,
        wordWrap: { width: layout.footerMaxWidth }
      })
      .setOrigin(0.5, 1)
      .setDepth(8)
      .setAlpha(0.88);

    this.difficultyHintText = this.add
      .text(layout.centerX, layout.difficultyY, this.buildDifficultyMenuLine(), {
        fontFamily: 'monospace',
        fontSize: '13px',
        fontStyle: '700',
        color: '#ff9a38',
        align: 'center'
      })
      .setOrigin(0.5)
      .setDepth(8)
      .setAlpha(0.92);

    this.refreshMenuSelectionVisuals();
    this.cameras.main.fadeIn(520, 0, 0, 0);

    this.registerInputListeners();
    this.touchInput.create();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.cleanupInputListeners, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.cleanupInputListeners, this);
  }

  update(): void {
    this.gamepadInput.update();
    this.touchInput.update();
    const touchMessage = this.touchInput.consumeStatusMessage();
    if (touchMessage) {
      this.gamepadStatusText.setText(touchMessage);
      this.gamepadStatusText.setAlpha(0.92);
    } else {
      this.gamepadStatusText.setText(this.gamepadInput.isConnected() ? 'CONTROL · DETECTADO' : 'CONTROL · SIN CONTROL');
      this.gamepadStatusText.setAlpha(this.gamepadInput.isConnected() ? 0.9 : 0.72);
    }

    if (this.touchInput.consumePressed('confirm') || this.touchInput.consumePressed('pause')) {
      this.handleMenuConfirm();
    }
    if (this.touchInput.consumePressed('cancel')) {
      this.handleMenuCancel();
    }
    if (this.gamepadInput.consumePressed('navUp') || this.touchInput.consumePressed('navUp')) {
      this.handleMenuSelectionUp();
    }
    if (this.gamepadInput.consumePressed('navDown') || this.touchInput.consumePressed('navDown')) {
      this.handleMenuSelectionDown();
    }
    if (this.touchInput.consumePressed('navLeft')) {
      this.handleMenuSelectionUp();
    }
    if (this.touchInput.consumePressed('navRight')) {
      this.handleMenuSelectionDown();
    }
    if (this.gamepadInput.consumePressed('confirm') || this.gamepadInput.consumePressed('pause')) {
      this.handleMenuConfirm();
    }
    if (this.gamepadInput.consumePressed('cancel')) {
      this.handleMenuCancel();
    }
  }

  private drawBackdrop(width: number, height: number): void {
    const graphics = this.add.graphics().setDepth(0);
    graphics.fillGradientStyle(0x030508, 0x030508, 0x0c1018, 0x06080c, 1);
    graphics.fillRect(0, 0, width, height);

    graphics.lineStyle(1, 0x1a2430, 0.3);
    for (let y = 0; y < height; y += 5) {
      graphics.lineBetween(0, y, width, y);
    }

    for (let i = 0; i < 14; i += 1) {
      const barY = 26 + i * 34;
      const barWidth = Math.round(width * (0.2 + (i % 4) * 0.13));
      const barX = i % 2 === 0 ? 0 : width - barWidth;
      const color = i % 3 === 0 ? MENU_CYAN : i % 3 === 1 ? MENU_EMBER : MENU_ROSE;
      graphics.fillStyle(color, 0.08);
      graphics.fillRect(barX, barY, barWidth, 6);
    }

    for (let i = 0; i < 28; i += 1) {
      const x = 24 + ((i * 73) % (width - 48));
      const y = 42 + ((i * 47) % (height - 84));
      const radius = i % 3 === 0 ? 2 : 1;
      const color = i % 4 < 2 ? MENU_EMBER : MENU_CYAN;
      graphics.fillStyle(color, i % 4 === 0 ? 0.34 : 0.18);
      graphics.fillCircle(x, y, radius);
    }
  }

  private drawTitleFrame(width: number, height: number, centerY: number): void {
    const graphics = this.add.graphics().setDepth(2);
    const frameWidth = Math.min(width - 120, 620);
    const frameHeight = Math.min(height * 0.2, 132);
    const frameX = width * 0.5 - frameWidth * 0.5;
    const frameY = centerY - frameHeight * 0.5;

    graphics.fillStyle(0x050810, 0.9);
    graphics.fillRoundedRect(frameX, frameY, frameWidth, frameHeight, 14);
    graphics.lineStyle(2, MENU_CYAN, 0.45);
    graphics.strokeRoundedRect(frameX, frameY, frameWidth, frameHeight, 14);
    graphics.lineStyle(1, MENU_EMBER, 0.25);
    graphics.strokeRoundedRect(frameX + 8, frameY + 8, frameWidth - 16, frameHeight - 16, 10);
  }

  private registerInputListeners(): void {
    if (this.inputListenersRegistered) this.cleanupInputListeners();
    const kb = this.input.keyboard;
    kb?.once('keydown-A', this.handleStartRaycast);
    kb?.once('keydown-a', this.handleStartRaycast);
    kb?.on('keydown-D', this.handleCycleDifficulty);
    kb?.on('keydown-d', this.handleCycleDifficulty);
    kb?.on('keydown-FOUR', this.handleBossMenuOne);
    kb?.on('keydown-FIVE', this.handleBossMenuTwo);
    kb?.on('keydown-SIX', this.handleBossMenuThree);
    kb?.on('keydown-S', this.handleOpenSettings);
    kb?.on('keydown-s', this.handleOpenSettings);
    this.inputListenersRegistered = true;
  }

  private cleanupInputListeners(): void {
    if (!this.inputListenersRegistered) return;
    const kb = this.input.keyboard;
    kb?.off('keydown-A', this.handleStartRaycast);
    kb?.off('keydown-a', this.handleStartRaycast);
    kb?.off('keydown-D', this.handleCycleDifficulty);
    kb?.off('keydown-d', this.handleCycleDifficulty);
    kb?.off('keydown-FOUR', this.handleBossMenuOne);
    kb?.off('keydown-FIVE', this.handleBossMenuTwo);
    kb?.off('keydown-SIX', this.handleBossMenuThree);
    kb?.off('keydown-S', this.handleOpenSettings);
    kb?.off('keydown-s', this.handleOpenSettings);
    this.gamepadInput?.destroy();
    this.touchInput?.destroy();
    this.inputListenersRegistered = false;
  }

  private refreshMenuSelectionVisuals(): void {
    this.startLine?.setColor(this.menuSelectionIndex === 0 ? '#ffffff' : MENU_CYAN_SOFT);
    this.settingsLine?.setColor(this.menuSelectionIndex === 1 ? '#ffd0e8' : MENU_SETTINGS);
  }

  private playFeedbackEvent(event: 'difficultySelect' | 'difficultyStart'): void {
    getRaycastFeedbackActions(event).forEach((action) => {
      this.audioFeedback.play(action.cue, action.intensity, this.time.now + (action.delayMs ?? 0));
    });
  }
}
