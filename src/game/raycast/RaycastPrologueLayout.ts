export const PROLOGUE_SAFE_MARGIN_PX = 48;

export interface PrologueScreenLayout {
  centerX: number;
  contentWidth: number;
  columnWidth: number;
  titleY: number;
  missionX: number;
  objectiveX: number;
  controlsX: number;
  missionY: number;
  objectiveY: number;
  controlsY: number;
  modifierY: number;
  promptY: number;
  gamepadY: number;
  twoColumn: boolean;
  fontTitle: string;
  fontBody: string;
  fontSmall: string;
}

/** Safe centered layout: vertical stack by default; two columns only on wide viewports. */
export function computePrologueScreenLayout(width: number, height: number): PrologueScreenLayout {
  const short = height <= 500;
  const centerX = width * 0.5;
  const safeWidth = Math.max(280, width - PROLOGUE_SAFE_MARGIN_PX * 2);
  const contentWidth = Math.min(safeWidth, 640);
  const twoColumn = width >= 900 && height >= 480;
  const columnGap = 36;
  const columnWidth = twoColumn
    ? Math.floor((contentWidth - columnGap) / 2)
    : contentWidth;

  const missionX = twoColumn ? centerX - (columnWidth + columnGap) * 0.5 : centerX;
  const controlsX = twoColumn ? centerX + (columnWidth + columnGap) * 0.5 : centerX;
  const objectiveX = missionX;

  const titleY = PROLOGUE_SAFE_MARGIN_PX + (short ? 4 : 8);
  const missionY = titleY + (short ? 40 : 48);
  const objectiveY = missionY + (short ? 48 : 54);
  const controlsY = twoColumn ? missionY : objectiveY + (short ? 44 : 50);
  const bottomReserve = short ? 118 : 132;
  const modifierY = Math.max(controlsY + (twoColumn ? 72 : 64), height - bottomReserve);

  return {
    centerX,
    contentWidth,
    columnWidth,
    titleY,
    missionX,
    objectiveX,
    controlsX,
    missionY,
    objectiveY,
    controlsY,
    modifierY,
    promptY: height - (short ? 46 : 52),
    gamepadY: height - (short ? 72 : 80),
    twoColumn,
    fontTitle: short ? '15px' : '18px',
    fontBody: short ? '12px' : '13px',
    fontSmall: short ? '10px' : '11px',
  };
}

export function buildPrologueModifierBlock(
  modifierId: string | null,
  getModifierById: (id: string | null) => { label: string; summary: string; details: string } | undefined | null,
): string {
  const selected = modifierId ? getModifierById(modifierId) : null;
  if (!selected) {
    return [
      '// MODIFICADORES (OPCIONAL)',
      'ACTIVO // NINGUNO',
      'M cambiar  ·  R aleatorio  ·  N limpiar',
    ].join('\n');
  }
  return [
    '// MODIFICADORES (OPCIONAL)',
    `ACTIVO // ${selected.label}`,
    selected.summary,
    selected.details,
    'M cambiar  ·  R aleatorio  ·  N limpiar',
  ].join('\n');
}
