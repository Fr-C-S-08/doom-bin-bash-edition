export type RaycastActiveInputKind = 'keyboard_mouse' | 'gamepad' | 'touch';

export interface RaycastActiveInputSnapshot {
  gamepadConnected: boolean;
  touchActive: boolean;
  touchControlsEnabled: boolean;
}

const ACTIVE_INPUT_LABELS: Record<RaycastActiveInputKind, string> = {
  keyboard_mouse: 'teclado/mouse',
  gamepad: 'control',
  touch: 'táctil'
};

const CONTROLS_HELP: Record<RaycastActiveInputKind, readonly string[]> = {
  keyboard_mouse: [
    'WASD · mover',
    'Mouse · mirar (clic para capturar)',
    'Q/E · girar',
    'Clic / Espacio · disparar',
    'R · recargar',
    '1–3 · armas',
    'M · minimapa',
    'ESC / P · pausa'
  ],
  gamepad: [
    'Stick izq · mover',
    'Stick der · mirar',
    'RT · disparar',
    'X · recargar',
    'LB/RB · cambiar arma',
    'Start · pausa',
    'D-pad · menú (en pausa)'
  ],
  touch: [
    'Joystick izq · mover',
    'Arrastrar derecha · mirar',
    'DISPARAR / RECARGAR · combate',
    '1–3 · armas',
    'MAPA · minimapa',
    'PAUSA · menú',
    'Horizontal recomendado en iPad'
  ]
};

export function getRaycastActiveInputLabel(kind: RaycastActiveInputKind): string {
  return ACTIVE_INPUT_LABELS[kind];
}

export function formatRaycastActiveInputLine(kind: RaycastActiveInputKind): string {
  return `Entrada activa: ${getRaycastActiveInputLabel(kind)}`;
}

export function getRaycastControlsHelpLines(kind: RaycastActiveInputKind): readonly string[] {
  return CONTROLS_HELP[kind];
}

export function formatRaycastControlsHelpBlock(kind: RaycastActiveInputKind, maxLines = 6): string {
  return getRaycastControlsHelpLines(kind)
    .slice(0, maxLines)
    .join(' · ');
}

/**
 * Resolves which control scheme to show in pause/settings.
 * `lastDetected` wins when still valid (gamepad connected / touch active).
 */
export function resolveRaycastActiveInput(
  snapshot: RaycastActiveInputSnapshot,
  lastDetected?: RaycastActiveInputKind
): RaycastActiveInputKind {
  if (lastDetected === 'touch' && snapshot.touchActive && snapshot.touchControlsEnabled) return 'touch';
  if (lastDetected === 'gamepad' && snapshot.gamepadConnected) return 'gamepad';
  if (lastDetected === 'keyboard_mouse') return 'keyboard_mouse';
  if (snapshot.touchActive && snapshot.touchControlsEnabled) return 'touch';
  if (snapshot.gamepadConnected) return 'gamepad';
  return 'keyboard_mouse';
}

export function isRaycastAimAssistInputKind(kind: RaycastActiveInputKind): boolean {
  return kind === 'gamepad' || kind === 'touch';
}
