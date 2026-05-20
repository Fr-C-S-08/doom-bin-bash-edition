import Phaser from 'phaser';
import type { RaycastHudCssBundle } from './RaycastPalette';
import {
  advanceNarrationQueue,
  buildRaycastNarrationLayout,
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
import { buildRaycastNarrationFxState } from './RaycastNarrationFx';
import { RAYCAST_NARRATION_PALETTE } from './RaycastNarrationPalette';

export { pickRaycastNarrationMockLine } from './RaycastNarration';
export type { RaycastNarrationOverlayConfig } from './RaycastNarration';

export interface RaycastNarrationOverlayRuntimeOptions {
  debug?: boolean;
  onTransmissionStart?: () => void;
}

export class RaycastNarrationOverlay {
  private readonly scene: Phaser.Scene;
  private readonly layout: RaycastNarrationLayout;
  private readonly palette = RAYCAST_NARRATION_PALETTE;
  private config: Required<RaycastNarrationOverlayConfig>;
  private runtime: RaycastNarrationOverlayRuntimeOptions;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly panelGlow: Phaser.GameObjects.Rectangle;
  private readonly scanline: Phaser.GameObjects.Rectangle;
  private readonly staticBars: Phaser.GameObjects.Rectangle[];
  private readonly headerText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly debugText: Phaser.GameObjects.Text;
  private queue: RaycastNarrationQueueState = createRaycastNarrationQueueState();
  private suppressed = false;
  private lastTransmissionAt = 0;
  private fxFrame = 0;

  constructor(
    scene: Phaser.Scene,
    width: number,
    height: number,
    hudCss: RaycastHudCssBundle,
    config: RaycastNarrationOverlayConfig = {},
    runtime: RaycastNarrationOverlayRuntimeOptions = {},
  ) {
    this.scene = scene;
    this.runtime = runtime;
    this.config = {
      displayMs: config.displayMs ?? RAYCAST_NARRATION_DEFAULT_DISPLAY_MS,
      fadeInMs: config.fadeInMs ?? RAYCAST_NARRATION_FADE_IN_MS,
      fadeOutMs: config.fadeOutMs ?? RAYCAST_NARRATION_FADE_OUT_MS,
      maxQueue: config.maxQueue ?? RAYCAST_NARRATION_MAX_QUEUE,
    };
    this.layout = buildRaycastNarrationLayout(width, height);
    const depthBase = 16;

    this.panelGlow = scene.add
      .rectangle(
        this.layout.centerX,
        this.layout.centerY,
        this.layout.panelWidth + 8,
        this.layout.panelHeight + 8,
        this.palette.panelGlow,
        0.35,
      )
      .setDepth(depthBase)
      .setVisible(false)
      .setAlpha(0);

    this.panel = scene.add
      .rectangle(
        this.layout.centerX,
        this.layout.centerY,
        this.layout.panelWidth,
        this.layout.panelHeight,
        this.palette.panelFill,
        0.94,
      )
      .setStrokeStyle(1, this.palette.panelStroke, 0.9)
      .setDepth(depthBase + 1)
      .setVisible(false)
      .setAlpha(0);

    this.scanline = scene.add
      .rectangle(
        this.layout.centerX,
        this.layout.centerY,
        this.layout.panelWidth - 12,
        2,
        this.palette.scanline,
        0.12,
      )
      .setDepth(depthBase + 2)
      .setVisible(false)
      .setAlpha(0);

    this.staticBars = [];
    const barWidth = 3;
    const gap = (this.layout.panelWidth - 24) / 5;
    for (let i = 0; i < 5; i += 1) {
      const bar = scene.add
        .rectangle(
          this.layout.centerX - this.layout.panelWidth * 0.5 + 12 + i * gap,
          this.layout.centerY - this.layout.panelHeight * 0.5 + 10,
          barWidth,
          6,
          this.palette.static,
          0.5,
        )
        .setDepth(depthBase + 2)
        .setVisible(false)
        .setAlpha(0);
      this.staticBars.push(bar);
    }

    this.headerText = scene.add
      .text(this.layout.centerX, this.layout.centerY - 40, '▌ RADIO // GAME MASTER', {
        fontFamily: 'monospace',
        fontSize: '10px',
        fontStyle: '700',
        color: this.palette.header,
        letterSpacing: 1.4,
      })
      .setOrigin(0.5, 0)
      .setDepth(depthBase + 3)
      .setVisible(false)
      .setAlpha(0);

    this.bodyText = scene.add
      .text(this.layout.centerX, this.layout.centerY - 22, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        fontStyle: '700',
        color: hudCss.accentText || this.palette.accent,
        align: 'left',
        lineSpacing: 5,
        wordWrap: { width: this.layout.bodyWrapWidth },
      })
      .setOrigin(0.5, 0)
      .setDepth(depthBase + 3)
      .setVisible(false)
      .setAlpha(0);

    this.debugText = scene.add
      .text(this.layout.centerX + this.layout.panelWidth * 0.5 - 8, this.layout.centerY - 44, 'GM·DBG', {
        fontFamily: 'monospace',
        fontSize: '8px',
        fontStyle: '700',
        color: this.palette.accentDim,
      })
      .setOrigin(1, 0)
      .setDepth(depthBase + 4)
      .setVisible(false)
      .setAlpha(0);
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

  showNarration(message: string): void {
    const wasIdle = !this.queue.active && this.queue.pending.length === 0;
    this.queue = enqueueNarrationMessage(
      this.queue,
      message,
      this.config.maxQueue,
      this.scene.time.now,
      this.config.displayMs,
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

    this.fxFrame += 1;
    const refreshFx = this.fxFrame % 2 === 0;
    const fx = refreshFx
      ? buildRaycastNarrationFxState(active, nowMs, this.config.fadeInMs, alpha)
      : buildRaycastNarrationFxState(active, nowMs - 1, this.config.fadeInMs, alpha);

    const panelAlpha = alpha * 0.86 * fx.flickerMul;
    const textAlpha = alpha * fx.flickerMul;
    const body = fx.showCursor ? `${active.message}▌` : active.message;

    this.panelGlow.setVisible(true).setAlpha(panelAlpha * 0.55);
    this.panel.setVisible(true).setAlpha(panelAlpha);
    this.scanline
      .setVisible(true)
      .setAlpha(panelAlpha * 0.35)
      .setY(this.layout.centerY - this.layout.panelHeight * 0.5 + 8 + (nowMs % 120) * 0.04);

    fx.staticHeights.forEach((heightMul, index) => {
      const bar = this.staticBars[index];
      if (!bar) return;
      bar
        .setVisible(true)
        .setAlpha(panelAlpha * 0.4)
        .setSize(bar.width, 4 + heightMul * 10);
    });

    this.headerText
      .setVisible(true)
      .setAlpha(textAlpha * 0.95)
      .setText(this.runtime.debug ? '▌ RADIO // GM [DEBUG]' : '▌ RADIO // GAME MASTER');

    this.bodyText
      .setText(body)
      .setVisible(true)
      .setAlpha(textAlpha)
      .setX(this.layout.centerX + fx.glitchOffsetX);

    this.debugText.setVisible(Boolean(this.runtime.debug)).setAlpha(textAlpha * 0.8);
  }

  private playTransmissionStart(): void {
    const now = this.scene.time.now;
    if (now - this.lastTransmissionAt < 180) return;
    this.lastTransmissionAt = now;
    this.runtime.onTransmissionStart?.();
  }

  private hideVisuals(): void {
    this.panelGlow.setVisible(false).setAlpha(0);
    this.panel.setVisible(false).setAlpha(0);
    this.scanline.setVisible(false).setAlpha(0);
    this.staticBars.forEach((bar) => bar.setVisible(false).setAlpha(0));
    this.headerText.setVisible(false).setAlpha(0);
    this.bodyText.setVisible(false).setAlpha(0);
    this.debugText.setVisible(false).setAlpha(0);
  }
}
