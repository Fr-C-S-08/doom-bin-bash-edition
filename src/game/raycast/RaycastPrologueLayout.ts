export const PROLOGUE_SAFE_MARGIN_PX = 64;

/** Estimated heights for bottom stack collision checks (px). */
export const PROLOGUE_MODIFIER_BLOCK_EST_HEIGHT_PX = 108;
export const PROLOGUE_PROMPT_TO_MODIFIER_GAP_PX = 28;
/** Extra space between mission block and objective block (objective only moves down). */
export const PROLOGUE_MISSION_TO_OBJECTIVE_GAP_SHORT_PX = 80;
export const PROLOGUE_MISSION_TO_OBJECTIVE_GAP_PX = 96;

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
  footerY: number;
  twoColumn: boolean;
  fontTitle: string;
  fontBody: string;
  fontSmall: string;
  fontPrompt: string;
}

/**
 * Bottom-anchored stack: modifiers → gamepad → ENTER/ESC → footer.
 * Main copy stays above the modifier block with safe margins (min 64px).
 */
export function computePrologueScreenLayout(width: number, height: number): PrologueScreenLayout {
  const short = height <= 560;
  const centerX = width * 0.5;
  const safeWidth = Math.max(320, width - PROLOGUE_SAFE_MARGIN_PX * 2);
  const contentWidth = Math.min(safeWidth, 760);
  const twoColumn = width >= 960 && height >= 520;
  const columnGap = 48;
  const columnWidth = twoColumn
    ? Math.floor((contentWidth - columnGap) / 2)
    : contentWidth;

  const missionX = twoColumn ? centerX - (columnWidth + columnGap) * 0.5 : centerX;
  const controlsX = twoColumn ? centerX + (columnWidth + columnGap) * 0.5 : centerX;
  const objectiveX = missionX;

  const promptBlockH = short ? 44 : 50;
  const gamepadH = 22;
  const bottomGap = short ? 16 : 20;

  const promptY = height - PROLOGUE_SAFE_MARGIN_PX;
  const gamepadY = promptY - promptBlockH - bottomGap;
  const modifierBottomY = gamepadY - gamepadH - PROLOGUE_PROMPT_TO_MODIFIER_GAP_PX;
  const modifierY = modifierBottomY - PROLOGUE_MODIFIER_BLOCK_EST_HEIGHT_PX;

  const titleY = PROLOGUE_SAFE_MARGIN_PX;
  const titleBlockH = short ? 42 : 52;
  const sectionGap = short ? 22 : 28;
  const missionY = titleY + titleBlockH + sectionGap;
  const objectiveY = missionY + (short ? PROLOGUE_MISSION_TO_OBJECTIVE_GAP_SHORT_PX : PROLOGUE_MISSION_TO_OBJECTIVE_GAP_PX);
  // Keep controls/modifiers/prompt anchored — only objective shifts down vs mission.
  const controlsY = twoColumn ? missionY + 8 : missionY + (short ? 108 : 124);

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
    promptY,
    gamepadY,
    footerY: height - 18,
    twoColumn,
    fontTitle: short ? '22px' : '26px',
    fontBody: short ? '15px' : '17px',
    fontSmall: short ? '13px' : '15px',
    fontPrompt: short ? '14px' : '16px',
  };
}

/** True when modifier block sits above prompt instructions with required gap. */
export function prologueModifierClearsPrompt(layout: PrologueScreenLayout): boolean {
  const modifierBottom = layout.modifierY + PROLOGUE_MODIFIER_BLOCK_EST_HEIGHT_PX;
  const promptTop = layout.promptY - (layout.fontPrompt === '14px' ? 44 : 50);
  return modifierBottom + PROLOGUE_PROMPT_TO_MODIFIER_GAP_PX <= promptTop;
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
