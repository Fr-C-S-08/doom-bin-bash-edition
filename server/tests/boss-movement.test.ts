import { describe, it, expect, beforeEach } from 'vitest';
import { ServerWorld } from '../src/ServerWorld.js';
import { RAYCAST_LEVEL_BOSS } from '../../src/game/raycast/RaycastLevel.js';

const ROTATION_INTERVAL_MS = 4500;
// One snapshot tick worth of ms — matches the server's TICK_INTERVAL_MS contract.
const TICK_MS = 50;

/** Advance the world by N ticks. */
function tickN(world: ServerWorld, n: number): void {
  for (let i = 0; i < n; i += 1) world.tick(TICK_MS);
}

describe('server boss movement', () => {
  let world: ServerWorld;

  beforeEach(() => {
    world = new ServerWorld();
    world.loadLevel(RAYCAST_LEVEL_BOSS.id);
  });

  it('spawns a boss state when loading the boss arena', () => {
    const boss = world.getBossState();
    expect(boss).not.toBeNull();
    expect(boss!.alive).toBe(true);
    expect(boss!.x).toBeCloseTo(RAYCAST_LEVEL_BOSS.bossConfig!.x);
    expect(boss!.y).toBeCloseTo(RAYCAST_LEVEL_BOSS.bossConfig!.y);
  });

  it('moves the boss when there is at least one alive player', () => {
    world.addPlayer('p1', 'Alice');
    // Boss starts at (7.5, 7.5); place the player offset so the boss has a
    // reason to move (distance > preferredRange ≈ 3.9 at phase 1).
    world.updatePlayerInput('p1', { x: 2.5, y: 2.5, yaw: 0, seq: 1 });

    const before = world.getBossState()!;
    const x0 = before.x;
    const y0 = before.y;

    // ~1.5 seconds of simulation.
    tickN(world, 30);

    const after = world.getBossState()!;
    const moved = Math.hypot(after.x - x0, after.y - y0);
    expect(moved).toBeGreaterThan(0.05);
  });

  it('does not move the boss when no players are alive', () => {
    const before = world.getBossState()!;
    const x0 = before.x;
    const y0 = before.y;

    tickN(world, 30);

    const after = world.getBossState()!;
    expect(after.x).toBeCloseTo(x0);
    expect(after.y).toBeCloseTo(y0);
    expect(world.getBossTargetPlayerId()).toBeNull();
  });

  it('rotates the boss movement target between players by time', () => {
    world.addPlayer('p1', 'Alice');
    world.addPlayer('p2', 'Bob');
    world.updatePlayerInput('p1', { x: 3.5, y: 3.5, yaw: 0, seq: 1 });
    world.updatePlayerInput('p2', { x: 11.5, y: 11.5, yaw: 0, seq: 1 });

    // First tick picks an initial target.
    world.tick(TICK_MS);
    expect(world.getBossTargetPlayerId()).toBe('p1');

    // Advance well past the rotation interval.
    tickN(world, Math.ceil(ROTATION_INTERVAL_MS / TICK_MS) + 2);
    expect(world.getBossTargetPlayerId()).toBe('p2');

    // One more rotation cycle wraps back to p1.
    tickN(world, Math.ceil(ROTATION_INTERVAL_MS / TICK_MS) + 2);
    expect(world.getBossTargetPlayerId()).toBe('p1');
  });

  it('keeps the single alive player as target across rotation intervals', () => {
    world.addPlayer('p1', 'Alice');
    world.updatePlayerInput('p1', { x: 3.5, y: 3.5, yaw: 0, seq: 1 });

    world.tick(TICK_MS);
    expect(world.getBossTargetPlayerId()).toBe('p1');

    // Even past two rotation cycles, with only one alive player the target stays.
    tickN(world, Math.ceil(ROTATION_INTERVAL_MS / TICK_MS) * 2 + 4);
    expect(world.getBossTargetPlayerId()).toBe('p1');
  });

  it('clears the boss target when loading a non-boss level', () => {
    world.addPlayer('p1', 'Alice');
    world.updatePlayerInput('p1', { x: 3.5, y: 3.5, yaw: 0, seq: 1 });
    world.tick(TICK_MS);
    expect(world.getBossTargetPlayerId()).toBe('p1');

    world.loadLevel('access-node');
    expect(world.getBossState()).toBeNull();
    expect(world.getBossTargetPlayerId()).toBeNull();
  });
});
