import { formatRaycastActiveInputLine, formatRaycastControlsHelpBlock, type RaycastActiveInputKind } from './RaycastInputHelp';
/** Pause menu labels shared by RaycastScene — keeps the gameplay scene slimmer. */

export const RAYCAST_PAUSE_MENU_LABELS = [
  'Reanudar',
  'Reiniciar nivel',
  'Ajustes (GM / FPS)',
  'Controles de entrada',
  'Menú principal',
  'Subir volumen',
  'Bajar volumen',
  'Alternar minimapa',
  'Alternar HUD debug',
] as const;

export type RaycastPauseMenuAction =
  | 'resume'
  | 'restart'
  | 'settings'
  | 'controls'
  | 'menu'
  | 'vol_up'
  | 'vol_down'
  | 'minimap'
  | 'debug';

export const RAYCAST_PAUSE_MENU_ACTIONS: RaycastPauseMenuAction[] = [
  'resume',
  'restart',
  'settings',
  'controls',
  'menu',
  'vol_up',
  'vol_down',
  'minimap',
  'debug',
];

export const RAYCAST_SETTINGS_GM_ROWS = [
  'gm_narration',
  'gm_voice',
  'gm_voice_volume',
  'gm_test',
] as const;

export const RAYCAST_SETTINGS_PERF_ROWS = [
  'fps_target',
  'render_quality',
  'minimap_quality',
] as const;

export const RAYCAST_SETTINGS_DEBUG_ROWS = ['debug_perf_hud', 'debug_gm_logs'] as const;

export const RAYCAST_SETTINGS_PAUSE_ROWS = [
  ...RAYCAST_SETTINGS_GM_ROWS,
  ...RAYCAST_SETTINGS_PERF_ROWS,
  ...RAYCAST_SETTINGS_DEBUG_ROWS,
  'back',
] as const;

export type RaycastSettingsPauseRow = (typeof RAYCAST_SETTINGS_PAUSE_ROWS)[number];

export const RAYCAST_CONTROL_PAUSE_ROWS = [
  'control',
  'mouse',
  'pad_sens',
  'left_deadzone',
  'right_deadzone',
  'invert_y',
  'vibration',
  'screenshake',
  'minimap',
  'back',
] as const;

export type RaycastControlPauseRow = (typeof RAYCAST_CONTROL_PAUSE_ROWS)[number];

const DEFAULT_COL_CHARS = 30;

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

export interface RaycastSettingsPauseModel {
  activeInput: RaycastActiveInputKind;
  selectionIndex: number;
  gmNarration: string;
  gmVoice: string;
  gmVoiceVolume: string;
  gmStatus: string;
  gmTestHint: string;
  fpsTarget: string;
  renderQuality: string;
  minimapQuality: string;
  debugPerfHud: string;
  debugGmLogs: string;
}

export interface RaycastControlPauseModel {
  activeInput: RaycastActiveInputKind;
  controlStatus: string;
  gamepadDebugLine?: string;
  gamepadLiveLine?: string;
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

function formatSectionHeader(title: string): string {
  return `// ${title}`;
}

function formatSettingsRow(
  rowId: RaycastSettingsPauseRow,
  label: string,
  value: string,
  selectionIndex: number,
): string {
  const idx = RAYCAST_SETTINGS_PAUSE_ROWS.indexOf(rowId);
  const prefix = idx === selectionIndex ? '>' : ' ';
  return `${prefix} ${label.padEnd(16)} ${value}`;
}

/**
 * Menú de pausa principal: columnas compactas, controles resumidos, menú al final.
 */
export function formatRaycastPauseMenuMxBody(
  model: RaycastPauseMenuMxModel,
  opts?: { columnChars?: number },
): string {
  const w = opts?.columnChars ?? DEFAULT_COL_CHARS;
  const L = (s: string) => truncatePauseField(s, w);
  const col = (left: string, right: string) => `${left.padEnd(w)} │ ${right}`;

  const leftBlock = [
    formatSectionHeader('PARTIDA'),
    L(`Mundo · ${model.worldLine}`),
    L(`Dificultad · ${model.difficultyLabel}`),
    L(`Puntaje · ${model.score}`),
    L(`Mejor · ${model.highScore}`),
    L(model.tokensLine),
    L(model.secretsLine),
  ];
  const rightBlock = [
    formatSectionHeader('OBJETIVO'),
    L(`Misión · ${model.missionLine}`),
    L(`Objetivo · ${model.objectiveLine}`),
    L(`Pista · ${model.hintLine}`),
    L(`Mods · ${model.modifiersLine}`),
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
    `VOLUMEN ${model.volumePct}%`,
    '',
    ...pairLines,
    '',
    formatSectionHeader('CONTROLES'),
    formatRaycastActiveInputLine(model.activeInput),
    truncatePauseField(formatRaycastControlsHelpBlock(model.activeInput).replace(/\n/g, ' · '), w * 2 + 4),
    '',
    formatSectionHeader('MENÚ'),
    ...menuLines,
    '',
    '↑↓ menú · ENTER · ESC',
  ].join('\n');
}

const SETTINGS_ROW_LABELS: Record<RaycastSettingsPauseRow, string> = {
  gm_narration: 'Narración',
  gm_voice: 'Voz',
  gm_voice_volume: 'Volumen voz',
  gm_test: 'Probar voz GM',
  fps_target: 'FPS objetivo',
  render_quality: 'Calidad render',
  minimap_quality: 'Minimapa calidad',
  debug_perf_hud: 'HUD perf',
  debug_gm_logs: 'Logs GM',
  back: 'Volver',
};

export function formatRaycastSettingsPauseBody(model: RaycastSettingsPauseModel): string {
  const valueByRow: Record<RaycastSettingsPauseRow, string> = {
    gm_narration: model.gmNarration,
    gm_voice: model.gmVoice,
    gm_voice_volume: model.gmVoiceVolume,
    gm_test: model.gmTestHint,
    fps_target: model.fpsTarget,
    render_quality: model.renderQuality,
    minimap_quality: model.minimapQuality,
    debug_perf_hud: model.debugPerfHud,
    debug_gm_logs: model.debugGmLogs,
    back: 'menú de pausa',
  };

  const lines: string[] = [
    'AJUSTES',
    formatRaycastActiveInputLine(model.activeInput),
    `Estado · ${model.gmStatus}`,
    '',
    formatSectionHeader('GAME MASTER'),
  ];

  for (const rowId of RAYCAST_SETTINGS_GM_ROWS) {
    lines.push(formatSettingsRow(rowId, SETTINGS_ROW_LABELS[rowId], valueByRow[rowId], model.selectionIndex));
  }

  lines.push('', formatSectionHeader('PERFORMANCE'));
  for (const rowId of RAYCAST_SETTINGS_PERF_ROWS) {
    lines.push(formatSettingsRow(rowId, SETTINGS_ROW_LABELS[rowId], valueByRow[rowId], model.selectionIndex));
  }

  lines.push('', formatSectionHeader('DEBUG'));
  for (const rowId of RAYCAST_SETTINGS_DEBUG_ROWS) {
    lines.push(formatSettingsRow(rowId, SETTINGS_ROW_LABELS[rowId], valueByRow[rowId], model.selectionIndex));
  }

  lines.push(
    '',
    formatSettingsRow('back', SETTINGS_ROW_LABELS.back, valueByRow.back, model.selectionIndex),
    '',
    '↑↓ navegar · ←→ cambiar · ENTER · ESC',
  );
  return lines.join('\n');
}

const CONTROL_ROW_LABELS: Record<RaycastControlPauseRow, string> = {
  control: 'Estado',
  mouse: 'Ratón sens',
  pad_sens: 'Mando sens',
  left_deadzone: 'Deadzone izq',
  right_deadzone: 'Deadzone der',
  invert_y: 'Invertir Y',
  vibration: 'Vibración',
  screenshake: 'Screenshake',
  minimap: 'Minimapa',
  back: 'Volver',
};

export function formatRaycastControlPauseBody(model: RaycastControlPauseModel, opts?: { columnChars?: number }): string {
  const w = opts?.columnChars ?? DEFAULT_COL_CHARS;
  const L = (s: string) => truncatePauseField(s, w);
  const valueByRow: Record<RaycastControlPauseRow, string> = {
    control: model.controlStatus,
    mouse: model.mouseSensitivity,
    pad_sens: model.gamepadSensitivity,
    left_deadzone: model.leftDeadzone,
    right_deadzone: model.rightDeadzone,
    invert_y: model.invertY,
    vibration: model.vibration,
    screenshake: model.screenshake,
    minimap: model.minimap,
    back: 'menú de pausa',
  };

  const lines: string[] = [
    'CONTROLES DE ENTRADA',
    formatRaycastActiveInputLine(model.activeInput),
    ...(model.gamepadDebugLine ? ['', L(model.gamepadDebugLine)] : []),
    ...(model.gamepadLiveLine ? ['', L(model.gamepadLiveLine)] : []),
    '',
    formatSectionHeader('CONTROLES'),
  ];

  for (const rowId of RAYCAST_CONTROL_PAUSE_ROWS) {
    if (rowId === 'control') continue;
    const idx = RAYCAST_CONTROL_PAUSE_ROWS.indexOf(rowId);
    const prefix = idx === model.selectionIndex ? '>' : ' ';
    lines.push(`${prefix} ${CONTROL_ROW_LABELS[rowId].padEnd(14)} ${valueByRow[rowId]}`);
  }

  lines.push('', '↑↓ · ←→ · ENTER · ESC');
  return lines.join('\n');
}
