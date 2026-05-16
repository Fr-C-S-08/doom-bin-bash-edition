export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  yaw: number;
  hp: number;
  maxHp: number;
  weapon: number;
  alive: boolean;
  respawnAtTick?: number;
}

export interface EnemyState {
  id: string;
  archetype: 'GRUNT' | 'BRUTE' | 'STALKER' | 'RANGED' | 'SCRAMBLER' | 'FLASHER';
  x: number;
  y: number;
  yaw: number;
  hp: number;
  state: 'SPAWN' | 'CHASE' | 'ATTACK' | 'DEAD';
}

export interface ProjectileState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
}

export interface ItemState {
  id: string;
  kind: string;
  x: number;
  y: number;
  taken: boolean;
}

export interface DoorState {
  id: string;
  open: boolean;
  requiresKey?: string;
}

export interface LevelState {
  keysCollected: string[];
  exitActive: boolean;
  secretsFound: number;
}
