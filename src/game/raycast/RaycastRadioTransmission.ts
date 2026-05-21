import type { RaycastHudLayout } from './RaycastHud';

export const RADIO_TRANSMISSION_MAX_LINES = 3;
export const RADIO_TRANSMISSION_TYPEWRITER_CPS = 42;

export interface RadioTransmissionLayout {
  originX: number;
  originY: number;
  panelWidth: number;
  panelHeight: number;
  bodyWrapWidth: number;
  liveIndicatorX: number;
  liveIndicatorY: number;
}

/** Compact radio box anchored below the minimap (top-left HUD). */
export function buildRadioTransmissionLayout(
  hud: Pick<
    RaycastHudLayout,
    'minimapPanelX' | 'minimapPanelY' | 'minimapPanelHeight' | 'minimapFrameWidth'
  >,
): RadioTransmissionLayout {
  const panelWidth = Math.min(252, Math.max(196, hud.minimapFrameWidth - 8));
  const panelHeight = 68;
  const originX = hud.minimapPanelX + 6;
  const originY = hud.minimapPanelY + hud.minimapPanelHeight + 10;
  return {
    originX,
    originY,
    panelWidth,
    panelHeight,
    bodyWrapWidth: panelWidth - 14,
    liveIndicatorX: originX + panelWidth - 6,
    liveIndicatorY: originY + 4,
  };
}

export function stripRadioTransmissionPrefixes(text: string): string {
  return text
    .replace(/\[?\s*GAME\s*MASTER\s*\]?/gi, '')
    .replace(/^RADIO\s*\/\/\s*/i, '')
    .replace(/[▌█■◆]/g, '')
    .trim();
}

export function sanitizeRadioDisplayText(text: string): string {
  const stripped = stripRadioTransmissionPrefixes(text);
  return stripped
    .replace(/[^\p{L}\p{N}\s.,;:!?¡¿'"()-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function wrapRadioTransmissionLine(text: string, maxChars: number): string[] {
  if (!text) return [];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word.length > maxChars ? `${word.slice(0, maxChars - 1)}…` : word;
  }
  if (current) lines.push(current);
  return lines;
}

export function paginateRadioTransmissionText(
  text: string,
  maxLines = RADIO_TRANSMISSION_MAX_LINES,
  wrapWidth = 38,
): string[] {
  const normalized = sanitizeRadioDisplayText(text);
  if (!normalized) return [];
  const wrapped = wrapRadioTransmissionLine(normalized, wrapWidth);
  if (wrapped.length <= maxLines) return wrapped;
  const pages: string[] = [];
  for (let i = 0; i < wrapped.length; i += maxLines) {
    pages.push(wrapped.slice(i, i + maxLines).join('\n'));
  }
  return pages;
}

export function computeRadioTypewriterText(
  fullText: string,
  startedAtMs: number,
  nowMs: number,
  charsPerSecond = RADIO_TRANSMISSION_TYPEWRITER_CPS,
): string {
  const elapsed = Math.max(0, nowMs - startedAtMs);
  const visibleChars = Math.min(fullText.length, Math.floor((elapsed / 1000) * charsPerSecond));
  return fullText.slice(0, visibleChars);
}

export function isRadioTypewriterComplete(
  fullText: string,
  startedAtMs: number,
  nowMs: number,
  charsPerSecond = RADIO_TRANSMISSION_TYPEWRITER_CPS,
): boolean {
  const elapsed = Math.max(0, nowMs - startedAtMs);
  const visibleChars = Math.floor((elapsed / 1000) * charsPerSecond);
  return visibleChars >= fullText.length;
}
