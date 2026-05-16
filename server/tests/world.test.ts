import { describe, it, expect, beforeEach } from 'vitest';
import { ServerWorld } from '../src/ServerWorld.js';

describe('ServerWorld', () => {
  let world: ServerWorld;

  beforeEach(() => {
    world = new ServerWorld();
  });

  it('addPlayer registers a player with default state', () => {
    world.addPlayer('p1', 'Alice');
    const snap = world.getSnapshot(1);
    expect(snap.players).toHaveLength(1);
    const p = snap.players[0];
    expect(p.id).toBe('p1');
    expect(p.name).toBe('Alice');
    expect(p.hp).toBe(100);
    expect(p.maxHp).toBe(100);
    expect(p.weapon).toBe(1);
    expect(p.alive).toBe(true);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
    expect(p.yaw).toBe(0);
  });

  it('removePlayer deletes the player from state', () => {
    world.addPlayer('p1', 'Alice');
    world.addPlayer('p2', 'Bob');
    world.removePlayer('p1');
    const snap = world.getSnapshot(1);
    expect(snap.players).toHaveLength(1);
    expect(snap.players[0].id).toBe('p2');
  });

  it('updatePlayerInput updates x, y, yaw for the player', () => {
    world.addPlayer('p1', 'Alice');
    world.updatePlayerInput('p1', { x: 3.5, y: 7.2, yaw: 1.57, seq: 42 });
    const snap = world.getSnapshot(1);
    const p = snap.players[0];
    expect(p.x).toBeCloseTo(3.5);
    expect(p.y).toBeCloseTo(7.2);
    expect(p.yaw).toBeCloseTo(1.57);
  });

  it('updatePlayerInput is a no-op for unknown player ids', () => {
    world.addPlayer('p1', 'Alice');
    // Should not throw
    world.updatePlayerInput('nonexistent', { x: 99, y: 99, yaw: 0, seq: 1 });
    const snap = world.getSnapshot(1);
    expect(snap.players[0].x).toBe(0);
  });

  it('getSnapshot includes all registered players', () => {
    world.addPlayer('p1', 'Alice');
    world.addPlayer('p2', 'Bob');
    world.addPlayer('p3', 'Carol');
    const snap = world.getSnapshot(5);
    expect(snap.type).toBe('snapshot');
    expect(snap.tick).toBe(5);
    expect(snap.players).toHaveLength(3);
    expect(snap.enemies).toHaveLength(0);
    expect(snap.level.exitActive).toBe(false);
  });

  it('getSnapshot returns a fresh object each call', () => {
    world.addPlayer('p1', 'Alice');
    const snap1 = world.getSnapshot(1);
    const snap2 = world.getSnapshot(2);
    expect(snap1.tick).toBe(1);
    expect(snap2.tick).toBe(2);
    expect(snap1.players).not.toBe(snap2.players);
  });
});
