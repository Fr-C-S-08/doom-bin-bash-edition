import { describe, expect, it } from 'vitest';
import {
  advanceNarrationQueue,
  buildRaycastNarrationLayout,
  computeNarrationOverlayAlpha,
  enqueueNarrationMessage,
  normalizeNarrationMessage,
  pickRaycastNarrationMockLine,
  RAYCAST_NARRATION_FADE_IN_MS,
  RAYCAST_NARRATION_FADE_OUT_MS,
  tickNarrationPhase,
  type RaycastNarrationActive,
} from '../game/raycast/RaycastNarration';

const CONFIG = {
  displayMs: 2_000,
  fadeInMs: RAYCAST_NARRATION_FADE_IN_MS,
  fadeOutMs: RAYCAST_NARRATION_FADE_OUT_MS,
  maxQueue: 4,
} as const;

describe('RaycastNarrationOverlay helpers', () => {
  it('buildRaycastNarrationLayout keeps a compact top-left radio band', () => {
    const layout = buildRaycastNarrationLayout(960, 540);
    expect(layout.originX).toBeLessThan(120);
    expect(layout.originY).toBeGreaterThan(200);
    expect(layout.originY).toBeLessThan(420);
    expect(layout.panelHeight).toBeLessThanOrEqual(72);
    expect(layout.bodyWrapWidth).toBeLessThan(layout.panelWidth);
  });

  it('normalizeNarrationMessage trims and collapses whitespace', () => {
    expect(normalizeNarrationMessage('  eco   militar  ')).toBe('eco militar');
    expect(normalizeNarrationMessage('   ')).toBe('');
  });

  it('pickRaycastNarrationMockLine returns non-empty Spanish copy', () => {
    expect(pickRaycastNarrationMockLine(0).length).toBeGreaterThan(12);
    expect(pickRaycastNarrationMockLine(1)).not.toBe(pickRaycastNarrationMockLine(0));
  });

  it('enqueueNarrationMessage starts active immediately when idle', () => {
    const state = enqueueNarrationMessage({ pending: [], active: null, queueCooldownUntilMs: 0 }, 'Primera línea');
    expect(state.active?.message).toBe('Primera línea');
    expect(state.pending).toEqual([]);
  });

  it('enqueueNarrationMessage queues while a line is active', () => {
    const active = {
      message: 'Activa',
      pages: ['Activa'],
      pageIndex: 0,
      tier: 'ambient' as const,
      phase: 'hold' as const,
      phaseStartedAtMs: 1_000,
      displayMs: 3_000,
      typewriterStartedAtMs: 1_000,
    };
    const state = enqueueNarrationMessage({ pending: [], active, queueCooldownUntilMs: 0 }, 'Siguiente');
    expect(state.pending).toEqual([{ message: 'Siguiente', tier: 'ambient' }]);
    expect(state.active?.message).toBe('Activa');
  });

  it('computeNarrationOverlayAlpha fades in, holds, then fades out', () => {
    let active: RaycastNarrationActive = {
      message: 'Test',
      pages: ['Test'],
      pageIndex: 0,
      tier: 'ambient',
      phase: 'fadeIn',
      phaseStartedAtMs: 1_000,
      displayMs: 2_000,
      typewriterStartedAtMs: 1_000,
    };

    expect(computeNarrationOverlayAlpha(active, 1_000, CONFIG)).toBe(0);
    expect(computeNarrationOverlayAlpha(active, 1_000 + CONFIG.fadeInMs, CONFIG)).toBe(1);

    active = tickNarrationPhase(active, 1_000 + CONFIG.fadeInMs, CONFIG);
    expect(active.phase).toBe('hold');
    expect(computeNarrationOverlayAlpha(active, 1_200, CONFIG)).toBeGreaterThan(0.8);

    active = tickNarrationPhase(active, active.phaseStartedAtMs + CONFIG.displayMs, CONFIG);
    expect(active.phase).toBe('fadeOut');
    const fadeOutStart = active.phaseStartedAtMs;
    expect(computeNarrationOverlayAlpha(active, fadeOutStart + CONFIG.fadeOutMs - 1, CONFIG)).toBeGreaterThan(0);
    expect(computeNarrationOverlayAlpha(active, fadeOutStart + CONFIG.fadeOutMs, CONFIG)).toBe(-1);
  });

  it('advanceNarrationQueue promotes the next pending line after a short gap', () => {
    const state = {
      pending: [{ message: 'Segunda', tier: 'ambient' as const }],
      active: {
        message: 'Primera',
        pages: ['Primera'],
        pageIndex: 0,
        tier: 'ambient' as const,
        phase: 'fadeOut' as const,
        phaseStartedAtMs: 5_000,
        displayMs: 1_000,
        typewriterStartedAtMs: 5_000,
      },
      queueCooldownUntilMs: 0,
    };

    const cooled = advanceNarrationQueue(state, 5_000 + CONFIG.fadeOutMs, CONFIG);
    expect(cooled.active).toBeNull();
    expect(cooled.queueCooldownUntilMs).toBeGreaterThan(5_000);

    const next = advanceNarrationQueue(cooled, cooled.queueCooldownUntilMs, CONFIG);
    expect(next.active?.message).toBe('Segunda');
    expect(next.pending).toEqual([]);
  });
});
