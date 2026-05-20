import { describe, expect, it } from 'vitest';
import {
  formatRaycastControlPauseBody,
  formatRaycastPauseMenuMxBody,
  RAYCAST_PAUSE_MENU_LABELS,
  truncatePauseField
} from '../game/raycast/RaycastPauseMenu';

describe('raycast pause menu formatting', () => {
  it('lays out two columns, single-line controls, and menu cursor', () => {
    const body = formatRaycastPauseMenuMxBody({
      activeInput: 'keyboard_mouse',
      volumePct: 80,
      selectionIndex: 2,
      worldLine: 'EP 1 · Sector demo',
      difficultyLabel: 'Standard',
      score: 1200,
      highScore: 4000,
      missionLine: 'Explora y exfiltra',
      objectiveLine: 'TOKEN',
      hintLine: 'Busca el token',
      tokensLine: 'Fichas · 1/2',
      secretsLine: 'Secretos · 0/1',
      modifiersLine: 'Ritmo estándar'
    });

    expect(body).toContain('VOLUMEN MAESTRO 80%');
    expect(body).toContain('// PARTIDA');
    expect(body).toContain('// OBJETIVO');
    expect(body).toContain('│');
    expect(body).toContain('CONTROLES');
    expect(body).toContain('Entrada activa: teclado/mouse');
    expect(body).toContain('WASD · mover');
    expect(body).toContain('Configuración de control');
    expect(body).toContain('// MENÚ');
    expect(body).toMatch(/Mundo ·/);
    expect(body).not.toContain('PROGRESO');
    expect(body).toContain(`> ${RAYCAST_PAUSE_MENU_LABELS[2]}`);
    expect(body).toContain(`  ${RAYCAST_PAUSE_MENU_LABELS[0]}`);
    expect(RAYCAST_PAUSE_MENU_LABELS.length).toBe(8);
  });

  it('truncates long pause fields safely', () => {
    expect(truncatePauseField('1234567890', 6).endsWith('…')).toBe(true);
    expect(truncatePauseField('short', 20)).toBe('short');
  });

  it('renders the pause control panel compactly and clearly', () => {
    const body = formatRaycastControlPauseBody({
      activeInput: 'gamepad',
      controlStatus: 'DETECTADO',
      selectionIndex: 2,
      mouseSensitivity: 'x1.00',
      gamepadSensitivity: 'x1.15',
      leftDeadzone: '0.18',
      rightDeadzone: '0.20',
      invertY: 'NO',
      vibration: 'SÍ',
      screenshake: 'SÍ',
      minimap: 'SÍ',
      gmNarration: 'SÍ',
      gmDuration: '5.2s',
      gmDebug: 'NO'
    });

    expect(body).toContain('CONFIGURACIÓN DE CONTROL');
    expect(body).toContain('Entrada activa: control');
    expect(body).toContain('Stick izq · mover');
    expect(body).toContain('CONTROL · DETECTADO');
    expect(body).toContain('RATÓN · sensibilidad x1.00');
    expect(body).toContain('MANDO · deadzone izq 0.18');
    expect(body).toContain('MANDO · invertir eje Y NO');
    expect(body).toContain('VOLVER AL MENÚ');
    expect(body).toContain('A confirmar');
  });
});
