import { formatRaycastActiveInputLine, formatRaycastControlsHelpBlock, type RaycastActiveInputKind } from './RaycastInputHelp';

/** Pause menu labels shared by RaycastScene — keeps the gameplay scene slimmer. */

export const RAYCAST_PAUSE_MENU_LABELS = [
  'Reanudar',
  'Reiniciar nivel',
  'Configuración de control',
  'Menú principal',
  'Subir volumen',
  'Bajar volumen',
  'Alternar minimapa',
  'Alternar HUD debug'
] as const;

export type RaycastPauseMenuAction =
  | 'resume'
  | 'restart'
  | 'controls'
  | 'menu'
  | 'vol_up'
  | 'vol_down'
  | 'minimap'
  | 'debug';

export const RAYCAST_PAUSE_MENU_ACTIONS: RaycastPauseMenuAction[] = [
  'resume',
  'restart',
  'controls',
  'menu',
  'vol_up',
  'vol_down',
  'minimap',
  'debug'
];

const DEFAULT_COL_CHARS = 34;

export function truncatePauseField(text: string, maxChars: number): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, Math.max(1, maxChars - 1))}…`;
}

export interface RaycastPauseMenuMxModel {
  activeInput: RaycastActiveInputKind;
  volumePct: number;
  selectionIndex: number;
  worldLine: string;
  difficultyLabel: string;
  score: number;
  highScore: number;
  missionLine: string;
  objectiveLine: string;
  hintLine: string;
  tokensLine: string;
  secretsLine: string;
  modifiersLine: string;
}

export const RAYCAST_CONTROL_PAUSE_ROWS = ['control', 'mouse', 'pad_sens', 'left_deadzone', 'right_deadzone', 'invert_y', 'vibration', 'screenshake', 'minimap', 'back'] as const;

export type RaycastControlPauseRow = (typeof RAYCAST_CONTROL_PAUSE_ROWS)[number];

export interface RaycastControlPauseModel {
  activeInput: RaycastActiveInputKind;
  controlStatus: string;
  gamepadDebugLine?: string;
  selectionIndex: number;
  mouseSensitivity: string;
  gamepadSensitivity: string;
  leftDeadzone: string;
  rightDeadzone: string;
  invertY: string;
  vibration: string;
  screenshake: string;
  minimap: string;
}

/**
 * Texto del menú de pausa: dos columnas (PARTIDA | OBJETIVO), controles en una línea, lista de menú.
 * Pensado para panel central estrecho; truncado por columna.
 */
export function formatRaycastPauseMenuMxBody(
  model: RaycastPauseMenuMxModel,
  opts?: { columnChars?: number }
): string {
  const w = opts?.columnChars ?? DEFAULT_COL_CHARS;
  const L = (s: string) => truncatePauseField(s, w);
  const col = (left: string, right: string) => `${left.padEnd(w)} │ ${right}`;

  const leftBlock = [
    '// PARTIDA',
    L(`Mundo · ${model.worldLine}`),
    L(`Dificultad · ${model.difficultyLabel}`),
    L(`Puntaje · ${model.score}`),
    L(`Mejor puntaje · ${model.highScore}`),
    L(model.tokensLine),
    L(model.secretsLine)
  ];
  const rightBlock = [
    '// OBJETIVO',
    L(`Misión · ${model.missionLine}`),
    L(`Objetivo · ${model.objectiveLine}`),
    L(`Pista · ${model.hintLine}`),
    L(`Modificadores · ${model.modifiersLine}`)
  ];
  const n = Math.max(leftBlock.length, rightBlock.length);
  const pairLines: string[] = [];
  for (let i = 0; i < n; i += 1) {
    pairLines.push(col(leftBlock[i] ?? '', rightBlock[i] ?? ''));
  }

  const menuLines = RAYCAST_PAUSE_MENU_LABELS.map((label, i) => {
    const prefix = i === model.selectionIndex ? '> ' : '  ';
    return `${prefix}${label}`;
  });

  return [
    `VOLUMEN MAESTRO ${model.volumePct}%`,
    '',
    ...pairLines,
    '',
    formatRaycastActiveInputLine(model.activeInput),
    'CONTROLES',
    formatRaycastControlsHelpBlock(model.activeInput),
    '',
    '// MENÚ',
    ...menuLines,
    '',
    '↑ / ↓ elegir · ENTER aplicar · ESC cerrar'
  ].join('\n');
}

export function formatRaycastControlPauseBody(model: RaycastControlPauseModel, opts?: { columnChars?: number }): string {
  const w = opts?.columnChars ?? DEFAULT_COL_CHARS;
  const L = (s: string) => truncatePauseField(s, w);
  const rows: Array<[string, string]> = [
    ['// CONTROL', `CONTROL · ${model.controlStatus}`],
    ...(model.gamepadDebugLine ? [['', L(model.gamepadDebugLine)] as [string, string]] : []),
    ['// AJUSTES', L(`RATÓN · sensibilidad ${model.mouseSensitivity}`)],
    ['', L(`MANDO · sensibilidad ${model.gamepadSensitivity}`)],
    ['', L(`MANDO · deadzone izq ${model.leftDeadzone}`)],
    ['', L(`MANDO · deadzone der ${model.rightDeadzone}`)],
    ['', L(`MANDO · invertir eje Y ${model.invertY}`)],
    ['', L(`MANDO · vibración ${model.vibration}`)],
    ['', L(`PANTALLA · screenshake ${model.screenshake}`)],
    ['', L(`MINIMAPA · visible ${model.minimap}`)],
    ['', 'VOLVER AL MENÚ']
  ];
  const formatted = rows.map(([left, right], index) => {
    const prefix = index === model.selectionIndex ? '>' : ' ';
    if (left.startsWith('//')) return `${left}\n${prefix} ${right}`;
    return `  ${left.padEnd(10)} ${prefix} ${right}`;
  });
  return [
    'CONFIGURACIÓN DE CONTROL',
    formatRaycastActiveInputLine(model.activeInput),
    '',
    'CONTROLES',
    formatRaycastControlsHelpBlock(model.activeInput),
    '',
    ...formatted,
    '',
    '↑ / ↓ elegir · ← / → ajustar · A confirmar · B / ESC / START volver'
  ].join('\n');
}
