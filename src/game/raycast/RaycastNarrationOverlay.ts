import Phaser from 'phaser';
import type { GameMasterNarrationTier } from '../../services/gameMasterNarrationTypes';
import { isGameMasterVoiceSpeaking } from '../../services/gameMasterVoice';
import type { RaycastHudCssBundle } from './RaycastPalette';
import {
  advanceNarrationQueue,
  computeNarrationOverlayAlpha,
  createRaycastNarrationQueueState,
  enqueueNarrationMessage,
  RAYCAST_NARRATION_DEFAULT_DISPLAY_MS,
  RAYCAST_NARRATION_FADE_IN_MS,
  RAYCAST_NARRATION_FADE_OUT_MS,
  RAYCAST_NARRATION_MAX_QUEUE,
  tickNarrationPhase,
  type RaycastNarrationLayout,
  type RaycastNarrationOverlayConfig,
  type RaycastNarrationQueueState,
} from './RaycastNarration';
import { computeNarrationFlickerMul } from './RaycastNarrationFx';
import { RAYCAST_NARRATION_PALETTE } from './RaycastNarrationPalette';
import {
  computeRadioTypewriterText,
  isRadioTypewriterComplete,
  sanitizeRadioDisplayText,
} from './RaycastRadioTransmission';

export { pickRaycastNarrationMockLine } from './RaycastNarration';
export type { RaycastNarrationOverlayConfig } from './RaycastNarration';

export interface RaycastNarrationOverlayRuntimeOptions {
  debug?: boolean;
  onTransmissionStart?: () => void;
}

export class RaycastNarrationOverlay {
  private readonly scene: Phaser.Scene;
  private layout: RaycastNarrationLayout;
  private readonly palette = RAYCAST_NARRATION_PALETTE;
  private config: Required<RaycastNarrationOverlayConfig>;
  private runtime: RaycastNarrationOverlayRuntimeOptions;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly headerText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly liveText: Phaser.GameObjects.Text;
  private readonly debugText: Phaser.GameObjects.Text;
  private queue: RaycastNarrationQueueState = createRaycastNarrationQueueState();
  private suppressed = false;
  private lastTransmissionAt = 0;
  private updateTick = 0;
  private cachedBodyKey = '';
  private cachedBodyDisplay = '';
  private cachedHeader = 'RADIO // GM';

  constructor(
    scene: Phaser.Scene,
    layout: RaycastNarrationLayout,
    hudCss: RaycastHudCssBundle,
    config: RaycastNarrationOverlayConfig = {},
    runtime: RaycastNarrationOverlayRuntimeOptions = {},
  ) {
    this.scene = scene;
    this.layout = layout;
    this.runtime = runtime;
    this.config = {
      displayMs: config.displayMs ?? RAYCAST_NARRATION_DEFAULT_DISPLAY_MS,
      fadeInMs: config.fadeInMs ?? RAYCAST_NARRATION_FADE_IN_MS,
      fadeOutMs: config.fadeOutMs ?? RAYCAST_NARRATION_FADE_OUT_MS,
      maxQueue: config.maxQueue ?? RAYCAST_NARRATION_MAX_QUEUE,
    };
    const depthBase = 16;

    this.panel = scene.add
      .rectangle(
        layout.originX,
        layout.originY,
        layout.panelWidth,
        layout.panelHeight,
        this.palette.panelFill,
        0.42,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(1, this.palette.panelStroke, 0.72)
      .setDepth(depthBase)
      .setVisible(false)
      .setAlpha(0);

    this.headerText = scene.add
      .text(layout.originX + 8, layout.originY + 5, this.cachedHeader, {
        fontFamily: 'monospace',
        fontSize: '9px',
        fontStyle: '700',
        color: this.palette.header,
        letterSpacing: 1.1,
      })
      .setOrigin(0, 0)
      .setDepth(depthBase + 1)
      .setVisible(false)
      .setAlpha(0);

    this.liveText = scene.add
      .text(layout.liveIndicatorX, layout.liveIndicatorY, '● LIVE', {
        fontFamily: 'monospace',
        fontSize: '8px',
        fontStyle: '700',
        color: hudCss.accentText || this.palette.accent,
      })
      .setOrigin(1, 0)
      .setDepth(depthBase + 2)
      .setVisible(false)
      .setAlpha(0);

    this.bodyText = scene.add
      .text(layout.originX + 8, layout.originY + 20, '', {
        fontFamily: 'monospace',
        fontSize: '11px',
        fontStyle: '700',
        color: hudCss.accentText || this.palette.accent,
        align: 'left',
        lineSpacing: 3,
        wordWrap: { width: layout.bodyWrapWidth },
      })
      .setOrigin(0, 0)
      .setDepth(depthBase + 1)
      .setVisible(false)
      .setAlpha(0);

    this.debugText = scene.add
      .text(layout.originX + layout.panelWidth - 4, layout.originY + 5, 'DBG', {
        fontFamily: 'monospace',
        fontSize: '7px',
        fontStyle: '700',
        color: this.palette.accentDim,
      })
      .setOrigin(1, 0)
      .setDepth(depthBase + 2)
      .setVisible(false)
      .setAlpha(0);
  }

  setLayout(layout: RaycastNarrationLayout): void {
    this.layout = layout;
    this.panel.setPosition(layout.originX, layout.originY).setSize(layout.panelWidth, layout.panelHeight);
    this.headerText.setPosition(layout.originX + 8, layout.originY + 5);
    this.bodyText.setPosition(layout.originX + 8, layout.originY + 20).setWordWrapWidth(layout.bodyWrapWidth);
    this.liveText.setPosition(layout.liveIndicatorX, layout.liveIndicatorY);
    this.debugText.setPosition(layout.originX + layout.panelWidth - 4, layout.originY + 5);
  }

  applyConfig(config: RaycastNarrationOverlayConfig, runtime?: RaycastNarrationOverlayRuntimeOptions): void {
    this.config = {
      displayMs: config.displayMs ?? this.config.displayMs,
      fadeInMs: config.fadeInMs ?? this.config.fadeInMs,
      fadeOutMs: config.fadeOutMs ?? this.config.fadeOutMs,
      maxQueue: config.maxQueue ?? this.config.maxQueue,
    };
    if (runtime) this.runtime = { ...this.runtime, ...runtime };
  }

  showNarration(message: string, tier: GameMasterNarrationTier = 'ambient'): void {
    const wasIdle = !this.queue.active && this.queue.pending.length === 0;
    this.queue = enqueueNarrationMessage(
      this.queue,
      message,
      this.config.maxQueue,
      this.scene.time.now,
      this.config.displayMs,
      tier,
    );
    if (wasIdle && this.queue.active) {
      this.playTransmissionStart();
    }
  }

  setSuppressed(suppressed: boolean): void {
    this.suppressed = suppressed;
    if (suppressed) {
      this.hideVisuals();
    }
  }

  update(nowMs: number): void {
    if (this.suppressed) return;

    this.updateTick += 1;
    const throttleVisual = this.updateTick % 2 !== 0;

    if (this.queue.active) {
      this.queue = {
        ...this.queue,
        active: tickNarrationPhase(this.queue.active, nowMs, this.config),
      };
    }

    this.queue = advanceNarrationQueue(this.queue, nowMs, this.config);

    const active = this.queue.active;
    if (!active) {
      this.hideVisuals();
      return;
    }

    const alpha = computeNarrationOverlayAlpha(active, nowMs, this.config);
    if (alpha < 0) {
      this.hideVisuals();
      return;
    }

    if (throttleVisual && active.phase === 'hold') {
      return;
    }

    const flickerMul = computeNarrationFlickerMul(nowMs, alpha);
    const panelAlpha = alpha * 0.72 * flickerMul;
    const textAlpha = alpha * flickerMul;
    const pageText = active.pages[active.pageIndex] ?? active.message;
    const displayPage = sanitizeRadioDisplayText(pageText);
    const typed = computeRadioTypewriterText(displayPage, active.typewriterStartedAtMs, nowMs);
    const showCursor =
      active.phase === 'hold' && !isRadioTypewriterComplete(displayPage, active.typewriterStartedAtMs, nowMs);
    const body = showCursor ? `${typed}▌` : typed;
    const header = this.runtime.debug ? 'RADIO // GM · DBG' : 'RADIO // GM';
    const liveSpeaking = isGameMasterVoiceSpeaking();
    const liveAlpha = liveSpeaking ? textAlpha * (0.7 + Math.sin(nowMs * 0.012) * 0.25) : 0;

    if (this.cachedHeader !== header) {
      this.cachedHeader = header;
      this.headerText.setText(header);
    }
    const bodyKey = `${active.pageIndex}:${body}`;
    if (this.cachedBodyKey !== bodyKey) {
      this.cachedBodyKey = bodyKey;
      this.cachedBodyDisplay = body;
      this.bodyText.setText(body);
    }

    this.panel.setVisible(true).setAlpha(panelAlpha);
    this.headerText.setVisible(true).setAlpha(textAlpha * 0.95);
    this.bodyText.setVisible(true).setAlpha(textAlpha);
    this.liveText.setVisible(liveSpeaking).setAlpha(liveAlpha);
    this.debugText.setVisible(Boolean(this.runtime.debug)).setAlpha(textAlpha * 0.75);
  }

  private playTransmissionStart(): void {
    const now = this.scene.time.now;
    if (now - this.lastTransmissionAt < 180) return;
    this.lastTransmissionAt = now;
    this.runtime.onTransmissionStart?.();
  }

  private hideVisuals(): void {
    this.panel.setVisible(false).setAlpha(0);
    this.headerText.setVisible(false).setAlpha(0);
    this.bodyText.setVisible(false).setAlpha(0);
    this.liveText.setVisible(false).setAlpha(0);
    this.debugText.setVisible(false).setAlpha(0);
    this.cachedBodyKey = '';
  }
}
