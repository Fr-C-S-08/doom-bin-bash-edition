/** Diegetic Game Master / military radio terminal palette (world-agnostic). */
export const RAYCAST_NARRATION_PALETTE = {
  panelFill: 0x040a12,
  panelStroke: 0x2a6a58,
  panelGlow: 0x0d2830,
  accent: '#6ef2c8',
  accentDim: '#3a8a72',
  header: '#5f9a88',
  static: 0x9ad4c4,
  scanline: 0x72f2b0,
  cursor: '#a8ffe8',
} as const;

export type RaycastNarrationPalette = typeof RAYCAST_NARRATION_PALETTE;
