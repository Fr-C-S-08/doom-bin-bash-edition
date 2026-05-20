import type { DirectorState } from '../systems/DirectorState';
import type { WeaponKind } from '../systems/WeaponTypes';
import {
  computeGameMasterDangerLevel,
  type GameMasterGameplaySnapshot,
} from '../../services/gameMasterNarrationContext';

const WEAPON_NARRATION_LABELS: Record<WeaponKind, string> = {
  PISTOL: 'pistola',
  SHOTGUN: 'escopeta',
  LAUNCHER: 'lanzador',
};

export interface RaycastGameMasterSnapshotInput {
  levelId: string;
  levelName: string;
  worldSegment: string;
  difficultyId: string;
  playerHealth: number;
  playerMaxHealth: number;
  equippedWeapon: WeaponKind;
  activeEnemies: number;
  runStartedAtMs: number;
  ammoCurrent: number;
  ammoCapacity: number;
  currentWave: number;
  directorState: DirectorState | null;
  directorIntensityPercent: number;
  nowMs: number;
  bossDisplayName?: string;
  bossBehavior?: string;
  twinBossPresent?: boolean;
  pickupLabel?: string;
  rewardTier?: number;
}

export function formatWeaponForGameMaster(kind: WeaponKind): string {
  return WEAPON_NARRATION_LABELS[kind] ?? kind.toLowerCase();
}

export function buildRaycastGameMasterSnapshot(
  input: RaycastGameMasterSnapshotInput,
): GameMasterGameplaySnapshot {
  const playerHealthPercent = Math.round(
    Math.max(0, Math.min(100, (input.playerHealth / Math.max(1, input.playerMaxHealth)) * 100)),
  );
  const ammoCapacity = Math.max(1, input.ammoCapacity);
  const ammoPercent = Math.round(Math.max(0, Math.min(100, (input.ammoCurrent / ammoCapacity) * 100)));
  const ammoLow = ammoPercent <= 20;
  const survivalSeconds = Math.max(0, Math.floor((input.nowMs - input.runStartedAtMs) / 1000));

  const dangerLevel = computeGameMasterDangerLevel({
    playerHealthPercent,
    activeEnemies: input.activeEnemies,
    directorState: input.directorState,
    directorIntensityPercent: input.directorIntensityPercent,
    ammoLow,
  });

  return {
    levelId: input.levelId,
    levelName: input.levelName,
    worldSegment: input.worldSegment,
    difficultyId: input.difficultyId,
    playerHealthPercent,
    equippedWeapon: formatWeaponForGameMaster(input.equippedWeapon),
    activeEnemies: input.activeEnemies,
    survivalSeconds,
    ammoLow,
    ammoPercent,
    currentWave: input.currentWave,
    dangerLevel,
    directorState: input.directorState,
    directorIntensityPercent: input.directorIntensityPercent,
    nowMs: input.nowMs,
    bossDisplayName: input.bossDisplayName,
    bossBehavior: input.bossBehavior,
    twinBossPresent: input.twinBossPresent,
    pickupLabel: input.pickupLabel,
    rewardTier: input.rewardTier,
  };
}
