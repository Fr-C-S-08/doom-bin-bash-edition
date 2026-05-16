import type { PlayerState } from '../../shared/types.js';
import type { SnapshotMessage } from '../../shared/protocol.js';

export class ServerWorld {
  private readonly playerStates = new Map<string, PlayerState>();

  addPlayer(id: string, name: string): void {
    this.playerStates.set(id, {
      id,
      name,
      x: 0,
      y: 0,
      yaw: 0,
      hp: 100,
      maxHp: 100,
      weapon: 1,
      alive: true
    });
  }

  removePlayer(id: string): void {
    this.playerStates.delete(id);
  }

  updatePlayerInput(id: string, input: { x: number; y: number; yaw: number; seq: number }): void {
    const player = this.playerStates.get(id);
    if (!player) return;
    player.x = input.x;
    player.y = input.y;
    player.yaw = input.yaw;
  }

  getSnapshot(tick: number): SnapshotMessage {
    return {
      type: 'snapshot',
      tick,
      serverTime: Date.now(),
      players: Array.from(this.playerStates.values()),
      enemies: [],
      projectiles: [],
      items: [],
      doors: [],
      level: { keysCollected: [], exitActive: false, secretsFound: 0 }
    };
  }
}
