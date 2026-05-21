import { describe, expect, it } from 'vitest';
import {
  formatRaycastControlPauseBody,
  formatRaycastPauseMenuMxBody,
  formatRaycastSettingsPauseBody,
  RAYCAST_PAUSE_MENU_LABELS,
  RAYCAST_SETTINGS_PAUSE_ROWS,
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

    expect(body).toContain('VOLUMEN 80%');
    expect(body).toContain('// PARTIDA');
    expect(body).toContain('// OBJETIVO');
    expect(body).toContain('│');
    expect(body).toContain('CONTROLES');
    expect(body).toContain('Entrada activa: teclado/mouse');
    expect(body).toContain('WASD · mover');
    expect(body).toContain('Ajustes (GM / FPS)');
    expect(body).toContain('Controles de entrada');
    expect(body).toContain('// MENÚ');
    expect(body).toMatch(/Mundo ·/);
    expect(body).not.toContain('PROGRESO');
    expect(body).toContain(`> ${RAYCAST_PAUSE_MENU_LABELS[2]}`);
    expect(body).toContain(`  ${RAYCAST_PAUSE_MENU_LABELS[0]}`);
    expect(RAYCAST_PAUSE_MENU_LABELS.length).toBe(9);
    expect(body).toContain('// MENÚ');
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
    });

    expect(body).toContain('CONTROLES DE ENTRADA');
    expect(body).toContain('Entrada activa: control');
    expect(body).toContain('CONTROLES');
    expect(body).toContain('Ratón sens');
    expect(body).toContain('Deadzone izq');
    expect(body).toContain('Invertir Y');
    expect(body).toContain('Ratón sens');
    expect(body).toContain('Volver');
  });

  it('renders settings panel with Game Master and Performance sections', () => {
    const body = formatRaycastSettingsPauseBody({
      activeInput: 'keyboard_mouse',
      selectionIndex: 0,
      gmNarration: 'SÍ',
      gmVoice: 'NO',
      gmVoiceVolume: '100%',
      gmStatus: 'idle',
      gmTestHint: 'ENTER voz · G en juego',
      fpsTarget: '60 (objetivo)',
      renderQuality: 'Balanceado',
      minimapQuality: 'Media',
      debugPerfHud: 'NO',
      debugGmLogs: 'NO',
    });

    expect(body).toContain('// GAME MASTER');
    expect(body).toContain('Narración');
    expect(body).toContain('Volumen voz');
    expect(body).toContain('Estado · idle');
    expect(body).toContain('// PERFORMANCE');
    expect(body).toContain('Minimapa calidad');
    expect(body).toContain('// DEBUG');
    expect(body).toContain('HUD perf');
    expect(RAYCAST_SETTINGS_PAUSE_ROWS).toContain('gm_voice_volume');
    expect(RAYCAST_SETTINGS_PAUSE_ROWS).toContain('debug_gm_logs');
  });
});
