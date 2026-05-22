import { describe, it, expect, beforeEach } from 'vitest';
import { ServerWorld } from '../src/ServerWorld.js';
import { RAYCAST_LEVEL_1, RAYCAST_LEVEL_2, RAYCAST_LEVEL_3 } from '../../src/game/raycast/RaycastLevel.js';

// ── Level 1 geometry constants ───────────────────────────────────────────────
const L1_KEY    = { x: 4.5, y: 3.5 };          // rust-key (radius 0.28)
const L1_GATE   = { x: 8.5, y: 7.5 };          // rust-gate door
const L1_SHUTTER = { x: 20.5, y: 10.5 };       // service-shutter door
// Trigger zones — points well inside their rect bounds
const L1_T1 = { x: 11.7, y: 8.5 };             // gate-ambush (needs rust-gate open)
const L1_T2 = { x: 16.4, y: 10.5 };            // lateral-pressure (needs rust-gate)
const L1_T3 = { x: 23.0, y: 11.5 };            // east-overlook (needs rust-gate)
const L1_EXIT = { x: 16.5, y: 1.5 };           // foundry-exit (radius 0.35)

// ── Level 2 geometry constants ───────────────────────────────────────────────
const L2_KEY   = { x: 4.5, y: 3.5 };           // glass-sigil (radius 0.28)
const L2_DOOR  = { x: 8.5, y: 5.5 };           // cistern-gate
const L2_T1    = { x: 11.5, y: 6.0 };          // furnace-ambush (needs cistern-gate)
const L2_T2    = { x: 13.5, y: 1.8 };          // exit-lockdown (needs cistern-gate)
const L2_EXIT  = { x: 14.5, y: 1.5 };          // cistern-exit (radius 0.35)

/** Drive player through a sequence of positions, one tick per position. */
function walk(world: ServerWorld, positions: Array<{ x: number; y: number }>): void {
  for (const pos of positions) {
    world.updatePlayerInput('p1', { x: pos.x, y: pos.y, yaw: 0, seq: 0 });
    world.tick(50);
  }
}

describe('server level transitions', () => {
  let world: ServerWorld;

  beforeEach(() => {
    world = new ServerWorld();
    world.addPlayer('p1', 'Alice');
  });

  // ── loadLevel state reset ─────────────────────────────────────────────────

  it('starts on Level 1', () => {
    expect(world.getCurrentLevelId()).toBe(RAYCAST_LEVEL_1.id);
  });

  it('loadLevel resets enemies to the new level', () => {
    world.loadLevel(RAYCAST_LEVEL_2.id);
    const snap = world.getSnapshot(0);
    const aliveEnemies = snap.enemies.filter((e) => e.state !== 'DEAD');
    expect(aliveEnemies).toHaveLength(RAYCAST_LEVEL_2.initialSpawns.length);
  });

  it('loadLevel resets keys and doors', () => {
    // Collect the L1 key before loading L2
    walk(world, [L1_KEY]);
    expect(world.getSnapshot(0).level.keysCollected).toContain('rust-key');

    world.loadLevel(RAYCAST_LEVEL_2.id);
    const snap = world.getSnapshot(0);
    expect(snap.level.keysCollected).toHaveLength(0);
    expect(snap.doors.every((d) => !d.open)).toBe(true);
  });

  it('loadLevel teleports all players to the new playerStart with full HP', () => {
    // Damage the player first
    world.addPlayer('p2', 'Bob');
    const start = RAYCAST_LEVEL_2.playerStart;

    world.loadLevel(RAYCAST_LEVEL_2.id);
    const snap = world.getSnapshot(0);

    for (const p of snap.players) {
      expect(p.x).toBeCloseTo(start.x);
      expect(p.y).toBeCloseTo(start.y);
      expect(p.hp).toBe(p.maxHp);
      expect(p.alive).toBe(true);
    }
  });

  // ── Exit blocked without conditions ──────────────────────────────────────

  it('does NOT change level when player reaches exit without fulfilling conditions', () => {
    // Player goes straight to the exit — no key, no doors, no triggers
    walk(world, [L1_EXIT]);

    const events = world.drainEvents();
    const levelEvents = events.filter((e) => e.kind === 'levelChange' || e.kind === 'levelClear');
    expect(levelEvents).toHaveLength(0);
    expect(world.getCurrentLevelId()).toBe(RAYCAST_LEVEL_1.id);
  });

  // ── Full Level 1 → Level 2 walkthrough ───────────────────────────────────

  it('changes to Level 2 when all Level 1 conditions are met and exit is reached', () => {
    walk(world, [
      L1_KEY,      // tick 1: collect rust-key
      L1_GATE,     // tick 2: open rust-gate
      L1_SHUTTER,  // tick 3: open service-shutter
      L1_T1,       // tick 4: activate gate-ambush
      L1_T2,       // tick 5: activate lateral-pressure
      L1_T3,       // tick 6: activate east-overlook
      L1_EXIT,     // tick 7: reach exit → level change
    ]);

    const events = world.drainEvents();
    const change = events.find((e) => e.kind === 'levelChange') as
      | { kind: 'levelChange'; nextLevelId: string }
      | undefined;

    expect(change).toBeDefined();
    expect(change?.nextLevelId).toBe(RAYCAST_LEVEL_2.id);
    expect(world.getCurrentLevelId()).toBe(RAYCAST_LEVEL_2.id);
  });

  it('snapshot reflects Level 2 data immediately after transition', () => {
    walk(world, [L1_KEY, L1_GATE, L1_SHUTTER, L1_T1, L1_T2, L1_T3, L1_EXIT]);

    const snap = world.getSnapshot(0);

    // Keys and doors are from Level 2 (all fresh)
    expect(snap.level.keysCollected).toHaveLength(0);
    expect(snap.doors.every((d) => !d.open)).toBe(true);
    expect(snap.doors.map((d) => d.id)).toContain('cistern-gate');
    expect(snap.doors.map((d) => d.id)).not.toContain('rust-gate');

    // Enemies are Level 2's initial spawns
    const alive = snap.enemies.filter((e) => e.state !== 'DEAD');
    expect(alive).toHaveLength(RAYCAST_LEVEL_2.initialSpawns.length);
  });

  it('player position is reset to Level 2 playerStart after transition', () => {
    walk(world, [L1_KEY, L1_GATE, L1_SHUTTER, L1_T1, L1_T2, L1_T3, L1_EXIT]);

    const snap = world.getSnapshot(0);
    const p = snap.players[0]!;
    expect(p.x).toBeCloseTo(RAYCAST_LEVEL_2.playerStart.x);
    expect(p.y).toBeCloseTo(RAYCAST_LEVEL_2.playerStart.y);
    expect(p.alive).toBe(true);
  });

  // ── Level chaining: Level 1 → 2 → 3 ─────────────────────────────────────

  it('chains through Level 2 → Level 3 after completing Level 1', () => {
    // Complete Level 1
    walk(world, [L1_KEY, L1_GATE, L1_SHUTTER, L1_T1, L1_T2, L1_T3, L1_EXIT]);
    world.drainEvents(); // clear L1 events

    expect(world.getCurrentLevelId()).toBe(RAYCAST_LEVEL_2.id);

    // Complete Level 2
    walk(world, [
      L2_KEY,   // collect glass-sigil
      L2_DOOR,  // open cistern-gate
      L2_T1,    // activate furnace-ambush
      L2_T2,    // activate exit-lockdown
      L2_EXIT,  // reach exit → level change to Level 3
    ]);

    const events = world.drainEvents();
    const change = events.find((e) => e.kind === 'levelChange') as
      | { kind: 'levelChange'; nextLevelId: string }
      | undefined;

    expect(change).toBeDefined();
    expect(change?.nextLevelId).toBe(RAYCAST_LEVEL_3.id);
    expect(world.getCurrentLevelId()).toBe(RAYCAST_LEVEL_3.id);
  });

  it('does not re-trigger level change on subsequent ticks after transition', () => {
    walk(world, [L1_KEY, L1_GATE, L1_SHUTTER, L1_T1, L1_T2, L1_T3, L1_EXIT]);
    world.drainEvents(); // consume the levelChange event

    // Player is now in Level 2 at its playerStart — far from Level 1 exit.
    // Tick a few more times; no further level-change events should appear.
    world.tick(50);
    world.tick(50);
    const events = world.drainEvents();
    const levelEvents = events.filter((e) => e.kind === 'levelChange' || e.kind === 'levelClear');
    expect(levelEvents).toHaveLength(0);
  });
});
