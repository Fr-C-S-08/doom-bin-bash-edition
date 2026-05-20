import { describe, expect, it } from 'vitest';
import { buildRaycastHudLayout } from '../game/raycast/RaycastHud';
import { buildRaycastNarrationLayoutFromHud } from '../game/raycast/RaycastNarration';
import {
  paginateRadioTransmissionText,
  computeRadioTypewriterText,
  sanitizeRadioDisplayText,
} from '../game/raycast/RaycastRadioTransmission';

describe('raycast radio transmission', () => {
  it('anchors layout below minimap in the top-left band', () => {
    const hud = buildRaycastHudLayout(1440, 900);
    const layout = buildRaycastNarrationLayoutFromHud(hud);
    expect(layout.originY).toBeGreaterThan(hud.minimapPanelY + hud.minimapPanelHeight);
    expect(layout.originX).toBeLessThan(120);
    expect(layout.panelHeight).toBeLessThanOrEqual(72);
  });

  it('paginates long copy to max three lines per page', () => {
    const pages = paginateRadioTransmissionText(
      'Primera frase larga para radio. Segunda frase con detalle táctico. Tercera con aviso. Cuarta con cierre operativo.',
      3,
      24,
    );
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0].split('\n').length).toBeLessThanOrEqual(3);
  });

  it('sanitizes GM prefixes before display', () => {
    expect(sanitizeRadioDisplayText('[GAME MASTER] Canal activo.')).toBe('Canal activo.');
  });

  it('typewriter reveals text progressively', () => {
    const line = 'Señal estable.';
    expect(computeRadioTypewriterText(line, 0, 200).length).toBeGreaterThan(4);
    expect(computeRadioTypewriterText(line, 0, 200).length).toBeLessThan(line.length);
    expect(computeRadioTypewriterText(line, 0, 2_000)).toBe(line);
  });
});
