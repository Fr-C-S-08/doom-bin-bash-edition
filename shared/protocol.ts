import type { DoorState, EnemyState, ItemState, LevelState, PlayerState, ProjectileState } from './types.js';

// ---------------------------------------------------------------------------
// Client → Server
// ---------------------------------------------------------------------------

export interface HelloMessage {
  type: 'hello';
  name: string;
}

export interface InputMessage {
  type: 'input';
  seq: number;
  x: number;
  y: number;
  yaw: number;
  keys: string[];
}

export interface ShootMessage {
  type: 'shoot';
  x: number;
  y: number;
  yaw: number;
  weapon: number;
}

export interface InteractMessage {
  type: 'interact';
  targetId: string;
}

export interface SwitchWeaponMessage {
  type: 'switchWeapon';
  weapon: number;
}

// DEBUG: client-driven jump to a specific level for testing co-op flows
// (e.g. straight to the boss arena without playing through every level).
// Server broadcasts a levelChange event so every client transitions together.
// Remove or gate behind a flag before shipping.
export interface DebugJumpToLevelMessage {
  type: 'debugJumpToLevel';
  levelId: string;
}

export type ClientToServerMessage =
  | HelloMessage
  | InputMessage
  | ShootMessage
  | InteractMessage
  | SwitchWeaponMessage
  | DebugJumpToLevelMessage;

// ---------------------------------------------------------------------------
// Server → Client
// ---------------------------------------------------------------------------

export interface WelcomeMessage {
  type: 'welcome';
  playerId: string;
  mapId: string;
  config: {
    tickRate: number;
    respawnCooldownMs: number;
  };
}

export interface SnapshotMessage {
  type: 'snapshot';
  tick: number;
  serverTime: number;
  players: PlayerState[];
  enemies: EnemyState[];
  projectiles: ProjectileState[];
  items: ItemState[];
  doors: DoorState[];
  level: LevelState;
}

export type ServerEvent =
  | { type: 'event'; kind: 'shot'; from: string; dir: number }
  | { type: 'event'; kind: 'hit'; target: string; by: string; damage: number }
  | { type: 'event'; kind: 'death'; who: string }
  | { type: 'event'; kind: 'respawn'; who: string; at: [number, number] }
  | { type: 'event'; kind: 'doorOpen'; id: string }
  | { type: 'event'; kind: 'keyPickup'; color: string; by: string }
  | { type: 'event'; kind: 'itemPickup'; itemId: string; by: string }
  | { type: 'event'; kind: 'gameOver' }
  | { type: 'event'; kind: 'levelClear' }
  | { type: 'event'; kind: 'levelChange'; nextLevelId: string };

export interface ErrorMessage {
  type: 'error';
  reason: string;
}

export type ServerToClientMessage =
  | WelcomeMessage
  | SnapshotMessage
  | ServerEvent
  | ErrorMessage;
