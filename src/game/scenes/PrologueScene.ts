import Phaser from 'phaser';
import { getRaycastDifficultyPreset, RAYCAST_DIFFICULTY_REGISTRY_KEY, type RaycastDifficultyId } from '../raycast/RaycastDifficulty';
import { getPrologueCopy } from '../raycast/RaycastPresentation';
import { RAYCAST_CSS, RAYCAST_PALETTE } from '../raycast/RaycastPalette';
import {
  getRunModifierById,
  rollRunModifier,
  RUN_MODIFIER_ROULETTE,
  type RunModifierId
} from '../raycast/RunModifierRoulette';
import { createEmptyCampaignMetrics } from '../raycast/RaycastScore';
import {
  ensureSessionSettings,
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

const BG = RAYCAST_PALETTE.voidBlack;
const BODY_COLOR = RAYCAST_CSS.bodyText;
const MUTED_COLOR = RAYCAST_CSS.mutedText;
const ACCENT_COLOR = RAYCAST_CSS.accentText;

export interface PrologueSceneData {
  difficultyId?: RaycastDifficultyId;
  runModifierId?: RunModifierId | null;
}

export class PrologueScene extends Phaser.Scene {
  private difficultyId!: RaycastDifficultyId;
  private runModifierId: RunModifierId | null = null;
  private modifierText!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private gamepadStatusText!: Phaser.GameObjects.Text;
  private gamepadInput!: RaycastGamepadInput;
  private touchInput!: RaycastTouchInput;
  private inputListenersRegistered = false;

  private readonly handleContinueRaycast = (): void => {
    this.cleanupInputListeners();
    this.scene.start('RaycastScene', { difficultyId: this.difficultyId, runModifierId: this.runModifierId });
  };

  private readonly handleBackToMenu = (): void => {
    this.cleanupInputListeners();
    this.scene.start('MenuScene');
  };

  private jumpToBossFromPrologue(slot: RaycastBossShortcutSlot): void {
    this.cleanupInputListeners();
    this.scene.start('RaycastScene', {
      levelId: getRaycastBossLevelId(slot),
      difficultyId: this.difficultyId,
      carryScore: 0,
      carryCampaignMetrics: createEmptyCampaignMetrics(),
      rewardTier: 0,
      runModifierId: this.runModifierId
    });
  }

  private readonly handlePrologueBossOne = (): void => {
    this.jumpToBossFromPrologue(1);
  };

  private readonly handlePrologueBossTwo = (): void => {
    this.jumpToBossFromPrologue(2);
  };

  private readonly handlePrologueBossThree = (): void => {
    this.jumpToBossFromPrologue(3);
  };

  private shiftModifier(delta: number): void {
    if (this.runModifierId === null) {
      const seed = delta >= 0 ? 0 : RUN_MODIFIER_ROULETTE.length - 1;
      this.runModifierId = RUN_MODIFIER_ROULETTE[seed].id;
    } else {
      const idx = RUN_MODIFIER_ROULETTE.findIndex((m) => m.id === this.runModifierId);
      this.runModifierId = RUN_MODIFIER_ROULETTE[(idx + delta + RUN_MODIFIER_ROULETTE.length) % RUN_MODIFIER_ROULETTE.length].id;
    }
    this.modifierText?.setText(this.buildModifierPrompt());
  }

  constructor() {
    super('PrologueScene');
  }

  init(data: PrologueSceneData = {}): void {
    this.difficultyId = getRaycastDifficultyPreset(data.difficultyId ?? this.registry.get(RAYCAST_DIFFICULTY_REGISTRY_KEY)).id;
    this.registry.set(RAYCAST_DIFFICULTY_REGISTRY_KEY, this.difficultyId);
    this.runModifierId = data.runModifierId ?? null;
  }

  create(): void {
    ensureSessionSettings(this.registry);
    const width = this.scale.width;
    const height = this.scale.height;
    this.cameras.main.setBackgroundColor(BG);
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

    const backdrop = this.add.graphics().setDepth(0);
    backdrop.fillGradientStyle(0x020408, 0x020408, 0x080c14, 0x04060c, 1);
    backdrop.fillRect(0, 0, width, height);
    backdrop.lineStyle(1, 0x1e2a38, 0.28);
    for (let y = 0; y < height; y += 6) {
      backdrop.lineBetween(0, y, width, y);
    }

    const copy = getPrologueCopy();
    const horizontalPadding = Math.max(18, Math.floor(width * 0.045));
    const contentWidth = Math.min(width - horizontalPadding * 2, 760);
    const titleY = Math.max(20, Math.floor(height * 0.08));
    const missionY = titleY + 52;
    const objectiveY = missionY + 96;
    const controlsY = objectiveY + 92;
    const modifierY = controlsY + 112;
    const promptY = height - 52;

    this.add
      .text(width * 0.5, titleY, 'DOOM BIN BASH EDITION', {
        fontFamily: 'monospace',
        fontSize: width <= 720 ? '16px' : '20px',
        fontStyle: '700',
        color: ACCENT_COLOR,
        align: 'center',
        wordWrap: { width: contentWidth }
      })
      .setOrigin(0.5, 0)
      .setAlpha(0.85)
      .setDepth(4);

    this.add
      .text(width * 0.5, missionY, copy.missionBlock, {
        fontFamily: 'monospace',
        fontSize: width <= 720 ? '13px' : '15px',
        fontStyle: '700',
        color: BODY_COLOR,
        align: 'center',
        lineSpacing: 8,
        wordWrap: { width: Math.min(contentWidth, 720) }
      })
      .setOrigin(0.5, 0)
      .setDepth(4);

    this.add
      .text(width * 0.5, objectiveY, copy.objectiveBlock, {
        fontFamily: 'monospace',
        fontSize: width <= 720 ? '13px' : '15px',
        fontStyle: '700',
        color: ACCENT_COLOR,
        align: 'center',
        lineSpacing: 7,
        wordWrap: { width: Math.min(contentWidth, 720) }
      })
      .setOrigin(0.5, 0)
      .setDepth(4);

    this.add
      .text(width * 0.5, controlsY, copy.controlsBlock, {
        fontFamily: 'monospace',
        fontSize: width <= 720 ? '12px' : '13px',
        fontStyle: '700',
        color: MUTED_COLOR,
        align: 'center',
        lineSpacing: 6,
        wordWrap: { width: Math.min(contentWidth, 720) }
      })
      .setOrigin(0.5, 0)
      .setDepth(4)
      .setAlpha(0.92);

    this.promptText = this.add
      .text(width * 0.5, promptY, `${copy.continueLine}\n${copy.backLine}`, {
        fontFamily: 'monospace',
        fontSize: width <= 720 ? '10px' : '11px',
        color: ACCENT_COLOR,
        align: 'center',
        lineSpacing: 3,
        wordWrap: { width: contentWidth }
      })
      .setOrigin(0.5, 1)
      .setAlpha(0.8)
      .setDepth(5);

    this.gamepadStatusText = this.add
      .text(width * 0.5, promptY - 30, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9ef0cf',
        align: 'center'
      })
      .setOrigin(0.5, 1)
      .setAlpha(0.82)
      .setDepth(5);

    this.add
      .text(width * 0.5, height - 18, '// FRAGMENTO DE SEÑAL  ·  Made by Hotzh3', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: ACCENT_COLOR,
        align: 'center'
      })
      .setOrigin(0.5, 1)
      .setAlpha(0.55)
      .setDepth(4);

    this.modifierText = this.add
      .text(width * 0.5, modifierY, this.buildModifierPrompt(), {
        fontFamily: 'monospace',
        fontSize: width <= 720 ? '11px' : '12px',
        backgroundColor: '#05120ccc',
        color: ACCENT_COLOR,
        align: 'center',
        lineSpacing: 5,
        padding: { x: 12, y: 10 },
        wordWrap: { width: Math.min(contentWidth - 12, 720), useAdvancedWrap: true }
      })
      .setOrigin(0.5, 0)
      .setDepth(5)
      .setAlpha(0.94);

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
      this.handleContinueRaycast();
      return;
    }
    if (this.touchInput.consumePressed('cancel')) {
      this.handleBackToMenu();
      return;
    }
    if (this.touchInput.consumePressed('navRight') || this.touchInput.consumePressed('nextWeapon')) {
      this.shiftModifier(1);
    }
    if (this.touchInput.consumePressed('navLeft') || this.touchInput.consumePressed('previousWeapon')) {
      this.shiftModifier(-1);
    }
    if (this.gamepadInput.consumePressed('confirm') || this.gamepadInput.consumePressed('pause')) {
      this.handleContinueRaycast();
      return;
    }
    if (this.gamepadInput.consumePressed('cancel')) {
      this.handleBackToMenu();
      return;
    }
    if (this.gamepadInput.consumePressed('navRight') || this.gamepadInput.consumePressed('nextWeapon')) {
      this.shiftModifier(1);
    }
    if (this.gamepadInput.consumePressed('navLeft') || this.gamepadInput.consumePressed('previousWeapon')) {
      this.shiftModifier(-1);
    }
  }

  private registerInputListeners(): void {
    if (this.inputListenersRegistered) this.cleanupInputListeners();
    const kb = this.input.keyboard;

    kb?.once('keydown-SPACE', this.handleContinueRaycast);
    kb?.once('keydown-ENTER', this.handleContinueRaycast);
    kb?.once('keydown-A', this.handleContinueRaycast);
    kb?.once('keydown-a', this.handleContinueRaycast);
    kb?.on('keydown-M', this.handleCycleModifier);
    kb?.on('keydown-m', this.handleCycleModifier);
    kb?.on('keydown-R', this.handleRollModifier);
    kb?.on('keydown-r', this.handleRollModifier);
    kb?.on('keydown-N', this.handleClearModifier);
    kb?.on('keydown-n', this.handleClearModifier);
    kb?.on('keydown-FOUR', this.handlePrologueBossOne);
    kb?.on('keydown-FIVE', this.handlePrologueBossTwo);
    kb?.on('keydown-SIX', this.handlePrologueBossThree);

    kb?.once('keydown-ESC', this.handleBackToMenu);

    this.inputListenersRegistered = true;
  }

  private cleanupInputListeners(): void {
    if (!this.inputListenersRegistered) return;
    const kb = this.input.keyboard;

    kb?.off('keydown-SPACE', this.handleContinueRaycast);
    kb?.off('keydown-ENTER', this.handleContinueRaycast);
    kb?.off('keydown-A', this.handleContinueRaycast);
    kb?.off('keydown-a', this.handleContinueRaycast);
    kb?.off('keydown-M', this.handleCycleModifier);
    kb?.off('keydown-m', this.handleCycleModifier);
    kb?.off('keydown-R', this.handleRollModifier);
    kb?.off('keydown-r', this.handleRollModifier);
    kb?.off('keydown-N', this.handleClearModifier);
    kb?.off('keydown-n', this.handleClearModifier);
    kb?.off('keydown-FOUR', this.handlePrologueBossOne);
    kb?.off('keydown-FIVE', this.handlePrologueBossTwo);
    kb?.off('keydown-SIX', this.handlePrologueBossThree);
    kb?.off('keydown-ESC', this.handleBackToMenu);
    this.gamepadInput?.destroy();
    this.touchInput?.destroy();

    this.inputListenersRegistered = false;
  }

  private readonly handleCycleModifier = (): void => {
    this.shiftModifier(1);
  };

  private readonly handleRollModifier = (): void => {
    this.runModifierId = rollRunModifier().id;
    this.modifierText?.setText(this.buildModifierPrompt());
  };

  private readonly handleClearModifier = (): void => {
    this.runModifierId = null;
    this.modifierText?.setText(this.buildModifierPrompt());
  };

  private buildModifierPrompt(): string {
    const selected = getRunModifierById(this.runModifierId);
    if (!selected) {
      return 'RULETA DE MODIFICADORES (OPCIONAL)\nACTIVO // NINGUNO\nM CAMBIAR  |  R ALEATORIO  |  N LIMPIAR';
    }
    return `RULETA DE MODIFICADORES (OPCIONAL)\nACTIVO // ${selected.label}\n${selected.summary}\n${selected.details}\nM CAMBIAR  |  R ALEATORIO  |  N LIMPIAR`;
  }
}
