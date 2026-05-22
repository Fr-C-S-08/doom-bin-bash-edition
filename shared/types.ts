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
  // Boss state mirror for co-op: present only on boss arenas (e.g. volt-archon-pit).
  // Server owns the authoritative values; clients overwrite local boss state from these.
  bossHp?: number;
  bossMaxHp?: number;
  bossAlive?: boolean;
  bossX?: number;
  bossY?: number;
  // Player id the boss is currently chasing/attacking. Clients use this to
  // aim their local volleys at the same target the server picked, so the
  // rotation is visible to everyone (not just the boss's movement).
  bossTargetId?: string;
}
