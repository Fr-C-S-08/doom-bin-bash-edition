import { describe, expect, it } from 'vitest';
import {
  computePrologueScreenLayout,
  PROLOGUE_MISSION_TO_OBJECTIVE_GAP_PX,
  PROLOGUE_MISSION_TO_OBJECTIVE_GAP_SHORT_PX,
  PROLOGUE_MODIFIER_BLOCK_EST_HEIGHT_PX,
  PROLOGUE_PROMPT_TO_MODIFIER_GAP_PX,
  PROLOGUE_SAFE_MARGIN_PX,
  prologueModifierClearsPrompt,
} from '../game/raycast/RaycastPrologueLayout';

describe('raycast prologue layout', () => {
  it('keeps columns inside safe margins at 1440x900', () => {
    const layout = computePrologueScreenLayout(1440, 900);
    expect(layout.missionX).toBeGreaterThanOrEqual(PROLOGUE_SAFE_MARGIN_PX);
    expect(layout.controlsX).toBeLessThanOrEqual(1440 - PROLOGUE_SAFE_MARGIN_PX);
    expect(layout.missionX).toBeLessThan(layout.controlsX);
    expect(layout.twoColumn).toBe(true);
    expect(parseInt(layout.fontTitle, 10)).toBeGreaterThanOrEqual(22);
  });

  it('uses vertical stack on narrow viewports', () => {
    const layout = computePrologueScreenLayout(720, 560);
    expect(layout.twoColumn).toBe(false);
    expect(layout.missionX).toBe(layout.centerX);
    expect(layout.controlsX).toBe(layout.centerX);
  });

  it('places modifiers above ENTER/ESC without overlap at 1440x900', () => {
    const layout = computePrologueScreenLayout(1440, 900);
    expect(prologueModifierClearsPrompt(layout)).toBe(true);
    const modifierBottom = layout.modifierY + PROLOGUE_MODIFIER_BLOCK_EST_HEIGHT_PX;
    expect(modifierBottom + PROLOGUE_PROMPT_TO_MODIFIER_GAP_PX).toBeLessThan(layout.promptY - 40);
    expect(layout.modifierY).toBeLessThan(layout.gamepadY);
    expect(layout.gamepadY).toBeLessThan(layout.promptY);
  });

  it('separates objective block from mission without shifting bottom stack', () => {
    const layout = computePrologueScreenLayout(1440, 900);
    const gap = layout.objectiveY - layout.missionY;
    expect(gap).toBe(PROLOGUE_MISSION_TO_OBJECTIVE_GAP_PX);
    expect(gap).toBeGreaterThan(64);
    expect(layout.twoColumn).toBe(true);
    expect(layout.controlsY).toBe(layout.missionY + 8);

    const shortLayout = computePrologueScreenLayout(800, 520);
    expect(shortLayout.objectiveY - shortLayout.missionY).toBe(PROLOGUE_MISSION_TO_OBJECTIVE_GAP_SHORT_PX);
    expect(shortLayout.controlsY).toBe(shortLayout.missionY + 108);
    expect(layout.modifierY).toBeLessThan(layout.promptY);
  });

  it('uses 64px safe margins', () => {
    expect(PROLOGUE_SAFE_MARGIN_PX).toBe(64);
    const layout = computePrologueScreenLayout(1280, 720);
    expect(layout.titleY).toBeGreaterThanOrEqual(64);
    expect(layout.promptY).toBeLessThanOrEqual(720 - 64);
  });
});
