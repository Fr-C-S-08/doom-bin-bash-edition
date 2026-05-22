import type { SnapshotMessage } from '../../../shared/protocol.js';
import type { PlayerState } from '../../../shared/types.js';

export class NetState {
  lastSnapshot: SnapshotMessage | null = null;
  localPlayerId: string | null = null;

  applySnapshot(snap: SnapshotMessage): void {
    this.lastSnapshot = snap;
  }

  getRemotePlayers(): PlayerState[] {
    if (!this.lastSnapshot) return [];
    return this.lastSnapshot.players.filter((p) => p.id !== this.localPlayerId);
  }

  getLocalPlayer(): PlayerState | null {
    if (!this.lastSnapshot || !this.localPlayerId) return null;
    return this.lastSnapshot.players.find((p) => p.id === this.localPlayerId) ?? null;
  }

  getPlayerById(id: string): PlayerState | null {
    return this.lastSnapshot?.players.find((p) => p.id === id) ?? null;
  }
}
