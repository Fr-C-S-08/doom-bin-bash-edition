import type { GameMasterNarrationEventId } from './gameMasterNarrationTypes';

export type GameMasterDangerLevel = 'calm' | 'elevated' | 'critical' | 'extreme';

export interface GameMasterGameplaySnapshot {
  levelId: string;
  levelName: string;
  worldSegment: string;
  difficultyId: string;
  playerHealthPercent: number;
  equippedWeapon: string;
  activeEnemies: number;
  survivalSeconds: number;
  ammoLow: boolean;
  ammoPercent: number;
  currentWave: number;
  dangerLevel: GameMasterDangerLevel;
  directorState: string | null;
  directorIntensityPercent: number;
  nowMs: number;
  bossDisplayName?: string;
  bossBehavior?: string;
  twinBossPresent?: boolean;
  pickupLabel?: string;
  pickupKind?: string;
  rewardTier?: number;
  zoneId?: string | null;
  objectiveLabel?: string;
}

export function computeGameMasterDangerLevel(input: {
  playerHealthPercent: number;
  activeEnemies: number;
  directorState: string | null;
  directorIntensityPercent: number;
  ammoLow: boolean;
}): GameMasterDangerLevel {
  if (input.playerHealthPercent <= 20 || (input.activeEnemies >= 7 && input.playerHealthPercent <= 40)) {
    return 'extreme';
  }
  if (
    input.playerHealthPercent <= 35 ||
    input.activeEnemies >= 5 ||
    input.directorState === 'PRESSURE' ||
    input.directorState === 'AMBUSH'
  ) {
    return 'critical';
  }
  if (
    input.directorIntensityPercent >= 55 ||
    input.directorState === 'WARNING' ||
    input.activeEnemies >= 3 ||
    input.ammoLow
  ) {
    return 'elevated';
  }
  return 'calm';
}

export function buildGameMasterTelemetryBlock(snapshot: GameMasterGameplaySnapshot): string {
  const ammoLine = snapshot.ammoLow
    ? `munición baja (${snapshot.ammoPercent}%)`
    : `munición ${snapshot.ammoPercent}%`;

  const zoneLine = snapshot.zoneId ? `Zona activa: ${snapshot.zoneId}.` : '';
  const objectiveLine = snapshot.objectiveLabel ? `Objetivo: ${snapshot.objectiveLabel}.` : '';

  return [
    `Nivel ${snapshot.levelName} (${snapshot.levelId}), sector ${snapshot.worldSegment}.`,
    `Vida ${snapshot.playerHealthPercent}%, arma ${snapshot.equippedWeapon}, ${ammoLine}.`,
    `Hostiles activos: ${snapshot.activeEnemies}, oleada ${snapshot.currentWave}, peligro ${snapshot.dangerLevel}.`,
    `Dificultad ${snapshot.difficultyId}, supervivencia ${snapshot.survivalSeconds}s, director ${snapshot.directorState ?? 'n/d'} (${snapshot.directorIntensityPercent}%).`,
    zoneLine,
    objectiveLine,
  ]
    .filter((line) => line.length > 0)
    .join(' ');
}

const EVENT_CONTEXT_LINES: Record<GameMasterNarrationEventId, (snapshot: GameMasterGameplaySnapshot) => string> = {
  boss_spawn: (snapshot) => {
    const boss = snapshot.bossDisplayName ?? 'jefe desconocido';
    const behavior = snapshot.bossBehavior ?? 'volt-archon';
    const twin = snapshot.twinBossPresent ? ' Encuentro dual.' : '';
    return `Jefe ${boss} (${behavior}) entra al arena.${twin}`;
  },
  low_health: (snapshot) =>
    `El operador sangra: vida al ${snapshot.playerHealthPercent}%. La estación aprieta el cerco.`,
  wave_clear: (snapshot) =>
    `Oleada ${snapshot.currentWave} neutralizada; ${snapshot.activeEnemies} hostiles restantes. Respiro breve.`,
  player_death: (snapshot) =>
    `Señal cortada tras ${snapshot.survivalSeconds}s. Última arma: ${snapshot.equippedWeapon}, peligro ${snapshot.dangerLevel}.`,
  legendary_pickup: (snapshot) => {
    const label = snapshot.pickupLabel ?? 'recompensa núcleo';
    const tier = snapshot.rewardTier !== undefined ? ` tier ${snapshot.rewardTier}` : '';
    return `Botín legendario: ${label}${tier}. El búnker registra un pico de energía.`;
  },
  manual_debug: () =>
    'Prueba manual del operador. Emite una línea breve de radio militar según el estado táctico actual.',
  objective_complete: (snapshot) => {
    const goal = snapshot.objectiveLabel ?? 'salida del sector';
    return `Objetivo cumplido: ${goal}. Extracción o cierre de sector autorizado.`;
  },
  door_opened: (snapshot) => {
    const label = snapshot.pickupLabel ?? 'pasaje sellado';
    return `Puerta o portón abierto: ${label}. Ruta desbloqueada.`;
  },
  secret_found: (snapshot) => {
    const label = snapshot.pickupLabel ?? 'señal oculta';
    return `Secreto localizado: ${label}. El búnker registra anomalía.`;
  },
  pickup_key: (snapshot) => {
    const label = snapshot.pickupLabel ?? 'ficha de acceso';
    return `Recuperada ${label}. Rutas selladas pueden ceder.`;
  },
  pickup_health: (snapshot) => {
    const kind = snapshot.pickupKind ?? 'célula';
    return `Recogido ${kind}: integridad sube a ${snapshot.playerHealthPercent}%.`;
  },
  pickup_ammo: (snapshot) =>
    `Reabastecimiento: munición al ${snapshot.ammoPercent}% con ${snapshot.equippedWeapon}.`,
};

export function buildGameMasterNarrationContext(
  eventId: GameMasterNarrationEventId,
  snapshot: GameMasterGameplaySnapshot,
): string {
  const telemetry = buildGameMasterTelemetryBlock(snapshot);
  const moment = EVENT_CONTEXT_LINES[eventId](snapshot);
  return `${telemetry} ${moment} Tono: FPS retro raycast, sci-fi militar, atmósfera Doom/Halo/System Shock, español México, frases cortas.`;
}

export function buildGameMasterNarrationDedupeKey(
  eventId: GameMasterNarrationEventId,
  snapshot: GameMasterGameplaySnapshot,
  suffix?: string,
): string {
  const base = `${eventId}:${snapshot.levelId}`;
  if (suffix) return `${base}:${suffix}`;
  if (eventId === 'boss_spawn' && snapshot.bossDisplayName) {
    return `${base}:${snapshot.bossDisplayName}`;
  }
  if (eventId === 'low_health') {
    return `${base}:hp${Math.floor(snapshot.playerHealthPercent / 15)}`;
  }
  if (eventId === 'wave_clear') {
    return `${base}:wave${snapshot.currentWave}`;
  }
  if (eventId === 'player_death') {
    return `${base}:run${Math.floor(snapshot.nowMs / 1000)}`;
  }
  if (eventId === 'objective_complete') {
    return `${base}:clear`;
  }
  return base;
}
