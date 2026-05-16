import { describe, it, expect, beforeEach } from 'vitest';
import { NetState } from '../game/net/NetState';
import type { SnapshotMessage } from '../../shared/protocol';

function makeSnapshot(players: { id: string; name: string }[], tick = 1): SnapshotMessage {
  return {
    type: 'snapshot',
    tick,
    serverTime: Date.now(),
    players: players.map((p) => ({
      id: p.id,
      name: p.name,
      x: 0,
      y: 0,
      yaw: 0,
      hp: 100,
      maxHp: 100,
      weapon: 1,
      alive: true
    })),
    enemies: [],
    projectiles: [],
    items: [],
    doors: [],
    level: { keysCollected: [], exitActive: false, secretsFound: 0 }
  };
}

describe('NetState', () => {
  let state: NetState;

  beforeEach(() => {
    state = new NetState();
    state.localPlayerId = 'local-id';
  });

  it('getRemotePlayers returns empty array before any snapshot', () => {
    expect(state.getRemotePlayers()).toEqual([]);
  });

  it('getRemotePlayers filters out the local player', () => {
    state.applySnapshot(makeSnapshot([{ id: 'local-id', name: 'Me' }, { id: 'remote-1', name: 'Other' }]));
    const remote = state.getRemotePlayers();
    expect(remote).toHaveLength(1);
    expect(remote[0].id).toBe('remote-1');
  });

  it('applySnapshot replaces the previous snapshot', () => {
    state.applySnapshot(makeSnapshot([{ id: 'remote-1', name: 'A' }], 1));
    state.applySnapshot(makeSnapshot([{ id: 'remote-2', name: 'B' }], 2));
    expect(state.lastSnapshot?.tick).toBe(2);
    expect(state.getRemotePlayers()[0].id).toBe('remote-2');
  });

  it('getLocalPlayer returns null when localPlayerId is not in snapshot', () => {
    state.applySnapshot(makeSnapshot([{ id: 'someone-else', name: 'X' }]));
    expect(state.getLocalPlayer()).toBeNull();
  });

  it('getLocalPlayer returns the matching player from the snapshot', () => {
    state.applySnapshot(makeSnapshot([{ id: 'local-id', name: 'Me' }, { id: 'other', name: 'Y' }]));
    const local = state.getLocalPlayer();
    expect(local?.id).toBe('local-id');
  });

  it('getRemotePlayers returns all players when localPlayerId is null', () => {
    state.localPlayerId = null;
    state.applySnapshot(makeSnapshot([{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }]));
    // With no local id, no filtering — all players are "remote"
    expect(state.getRemotePlayers()).toHaveLength(2);
  });
});
