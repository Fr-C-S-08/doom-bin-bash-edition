
export interface PrologueScreenLayout {
  contentWidth: number;
  titleY: number;
  missionColumnX: number;
  controlsColumnX: number;
  columnWidth: number;
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

export function computePrologueScreenLayout(width: number, height: number): PrologueScreenLayout {
  const short = width <= 720 || height <= 500;
  const horizontalPadding = Math.max(20, Math.floor(width * 0.04));
  const contentWidth = Math.min(width - horizontalPadding * 2, 780);
  const twoColumn = width >= 760 && height >= 460;
  const columnWidth = twoColumn ? Math.floor((contentWidth - 28) / 2) : contentWidth;
  const missionColumnX = twoColumn ? width * 0.5 - columnWidth - 14 : width * 0.5;
  const controlsColumnX = twoColumn ? width * 0.5 + 14 : width * 0.5;

  const titleY = Math.max(16, Math.floor(height * 0.06));
  const missionY = titleY + (short ? 40 : 48);
  const objectiveY = missionY + (short ? 52 : 58);
  const controlsY = twoColumn ? missionY : objectiveY + (short ? 56 : 64);
  const modifierY = Math.min(height - (short ? 118 : 132), controlsY + (twoColumn ? 118 : 100));
  const gamepadY = height - (short ? 78 : 88);
  const promptY = height - (short ? 48 : 54);

  return {
    contentWidth,
    titleY,
    missionColumnX,
    controlsColumnX,
    columnWidth,
    missionY,
    objectiveY,
    controlsY,
    modifierY,
    promptY,
    gamepadY,
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
