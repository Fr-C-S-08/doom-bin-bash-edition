import { describe, expect, it } from 'vitest';
import {
  buildGameMasterNarrationContext,
  buildGameMasterTelemetryBlock,
  computeGameMasterDangerLevel,
} from '../services/gameMasterNarrationContext';

const BASE_SNAPSHOT = {
  levelId: 'test-sector',
  levelName: 'Sector Prueba',
  worldSegment: 'world1',
  difficultyId: 'normal',
  playerHealthPercent: 42,
  equippedWeapon: 'escopeta',
  activeEnemies: 4,
  survivalSeconds: 95,
  ammoLow: true,
  ammoPercent: 12,
  currentWave: 3,
  dangerLevel: 'critical' as const,
  directorState: 'PRESSURE',
  directorIntensityPercent: 72,
  nowMs: 50_000,
};

describe('gameMasterNarrationContext', () => {
  it('computeGameMasterDangerLevel escalates with health, enemies and director', () => {
    expect(
      computeGameMasterDangerLevel({
        playerHealthPercent: 90,
        activeEnemies: 0,
        directorState: 'CALM',
        directorIntensityPercent: 10,
        ammoLow: false,
      }),
    ).toBe('calm');

    expect(
      computeGameMasterDangerLevel({
        playerHealthPercent: 15,
        activeEnemies: 2,
        directorState: 'WARNING',
        directorIntensityPercent: 40,
        ammoLow: false,
      }),
    ).toBe('extreme');
  });

  it('buildGameMasterTelemetryBlock includes dynamic gameplay fields', () => {
    const block = buildGameMasterTelemetryBlock(BASE_SNAPSHOT);
    expect(block).toContain('42%');
    expect(block).toContain('escopeta');
    expect(block).toContain('munición baja');
    expect(block).toContain('oleada 3');
    expect(block).toContain('95s');
  });

  it('buildGameMasterNarrationContext adds event flavor and retro tone', () => {
    const context = buildGameMasterNarrationContext('wave_clear', BASE_SNAPSHOT);
    expect(context).toContain('oleada 3');
    expect(context).toContain('neutralizada');
    expect(context).toContain('Doom/Halo/System Shock');
  });

  it('buildGameMasterTelemetryBlock includes zone and objective when present', () => {
    const block = buildGameMasterTelemetryBlock({
      ...BASE_SNAPSHOT,
      zoneId: 'relay-core',
      objectiveLabel: 'ABRE LA SALIDA',
    });
    expect(block).toContain('relay-core');
    expect(block).toContain('ABRE LA SALIDA');
  });

  it('buildGameMasterNarrationContext covers gameplay pickup and door events', () => {
    const door = buildGameMasterNarrationContext('door_opened', {
      ...BASE_SNAPSHOT,
      pickupLabel: 'Pasaje norte',
    });
    expect(door).toContain('Pasaje norte');

    const secret = buildGameMasterNarrationContext('secret_found', {
      ...BASE_SNAPSHOT,
      pickupLabel: 'Caché lateral',
    });
    expect(secret).toContain('Caché lateral');

    const objective = buildGameMasterNarrationContext('objective_complete', {
      ...BASE_SNAPSHOT,
      objectiveLabel: 'EXTRACCIÓN',
    });
    expect(objective).toContain('EXTRACCIÓN');
  });
});
