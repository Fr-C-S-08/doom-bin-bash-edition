import { describe, it, expect, beforeEach } from 'vitest';
import { ServerWorld } from '../src/ServerWorld.js';
import { RAYCAST_LEVEL } from '../../src/game/raycast/RaycastLevel.js';

// Level 1 reference data (read-only; we never mutate RAYCAST_LEVEL directly).
const KEY = RAYCAST_LEVEL.keys.find((k) => k.id === 'rust-key')!;
const DOOR = RAYCAST_LEVEL.doors.find((d) => d.id === 'rust-gate')!;
const TRIGGER = RAYCAST_LEVEL.triggers.find((t) => t.id === 'gate-ambush')!;

// A point well inside gate-ambush (x:10.4–13.0, y:7.9–9.5).
const INSIDE_TRIGGER = { x: 11.7, y: 8.5 };

describe('server key/door mechanics', () => {
  let world: ServerWorld;

  beforeEach(() => {
    world = new ServerWorld();
    world.addPlayer('p1', 'Alice');
  });

  // ── Keys ──────────────────────────────────────────────────────────────────

  it('key appears uncollected in the snapshot initially', () => {
    const snap = world.getSnapshot(0);
    expect(snap.level.keysCollected).toHaveLength(0);
  });

  it('key is collected when an alive player stands on it', () => {
    world.updatePlayerInput('p1', { x: KEY.x, y: KEY.y, yaw: 0, seq: 1 });
    world.tick(50);

    const snap = world.getSnapshot(1);
    expect(snap.level.keysCollected).toContain(KEY.id);
  });

  it('key is not collected twice even if the player stays on it', () => {
    world.updatePlayerInput('p1', { x: KEY.x, y: KEY.y, yaw: 0, seq: 1 });
    world.tick(50);
    world.tick(100); // player still on key

    const snap = world.getSnapshot(2);
    expect(snap.level.keysCollected.filter((id) => id === KEY.id)).toHaveLength(1);
  });

  it('key is not collected when the player is far away', () => {
    world.updatePlayerInput('p1', { x: 2.5, y: 12.5, yaw: 0, seq: 1 });
    world.tick(50);

    const snap = world.getSnapshot(1);
    expect(snap.level.keysCollected).toHaveLength(0);
  });

  // ── Doors ─────────────────────────────────────────────────────────────────

  it('door appears closed in the snapshot initially', () => {
    const snap = world.getSnapshot(0);
    const door = snap.doors.find((d) => d.id === DOOR.id);
    expect(door).toBeDefined();
    expect(door?.open).toBe(false);
  });

  it('door does NOT open when player is near but has no key', () => {
    world.updatePlayerInput('p1', { x: DOOR.x, y: DOOR.y, yaw: 0, seq: 1 });
    world.tick(50);

    const snap = world.getSnapshot(1);
    const door = snap.doors.find((d) => d.id === DOOR.id);
    expect(door?.open).toBe(false);
  });

  it('door opens when player has the key and stands near it', () => {
    // Tick 1: collect the key.
    world.updatePlayerInput('p1', { x: KEY.x, y: KEY.y, yaw: 0, seq: 1 });
    world.tick(50);

    // Tick 2: stand at the door.
    world.updatePlayerInput('p1', { x: DOOR.x, y: DOOR.y, yaw: 0, seq: 2 });
    world.tick(100);

    const snap = world.getSnapshot(2);
    expect(snap.level.keysCollected).toContain(KEY.id);
    const door = snap.doors.find((d) => d.id === DOOR.id);
    expect(door?.open).toBe(true);
  });

  it('door does not emit a second doorOpen event if already open', () => {
    world.updatePlayerInput('p1', { x: KEY.x, y: KEY.y, yaw: 0, seq: 1 });
    world.tick(50);
    world.updatePlayerInput('p1', { x: DOOR.x, y: DOOR.y, yaw: 0, seq: 2 });
    world.tick(100);
    // Drain the events from the first two ticks (includes the legitimate doorOpen).
    world.drainEvents();

    // Tick 3: player still at the door — door is already open, no new event.
    world.tick(150);
    const afterEvents = world.drainEvents();
    const doorOpens = afterEvents.filter(
      (e) => e.kind === 'doorOpen' && (e as { id: string }).id === DOOR.id
    );
    expect(doorOpens).toHaveLength(0);
  });

  // ── Trigger unlocking (the key integration test) ───────────────────────────

  it('trigger with doorId does NOT fire before the door is open', () => {
    const initialEnemyCount = RAYCAST_LEVEL.initialSpawns.length;

    world.updatePlayerInput('p1', { x: INSIDE_TRIGGER.x, y: INSIDE_TRIGGER.y, yaw: 0, seq: 1 });
    world.tick(50);

    const snap = world.getSnapshot(1);
    // Trigger has 3 spawns; none should have fired because rust-gate is closed.
    expect(snap.enemies).toHaveLength(initialEnemyCount);
  });

  it('trigger with doorId fires after the door is open (key → door → trigger)', () => {
    const initialEnemyCount = RAYCAST_LEVEL.initialSpawns.length;
    const triggerSpawnCount = TRIGGER.spawns.length;

    // Step 1: collect the key.
    world.updatePlayerInput('p1', { x: KEY.x, y: KEY.y, yaw: 0, seq: 1 });
    world.tick(50);

    // Step 2: open rust-gate.
    world.updatePlayerInput('p1', { x: DOOR.x, y: DOOR.y, yaw: 0, seq: 2 });
    world.tick(100);

    // Step 3: enter the gate-ambush trigger zone.
    world.updatePlayerInput('p1', { x: INSIDE_TRIGGER.x, y: INSIDE_TRIGGER.y, yaw: 0, seq: 3 });
    world.tick(150);

    const snap = world.getSnapshot(3);
    expect(snap.enemies).toHaveLength(initialEnemyCount + triggerSpawnCount);
  });

  it('trigger once:true does not re-fire even after multiple ticks inside zone', () => {
    const initialEnemyCount = RAYCAST_LEVEL.initialSpawns.length;
    const triggerSpawnCount = TRIGGER.spawns.length;

    world.updatePlayerInput('p1', { x: KEY.x, y: KEY.y, yaw: 0, seq: 1 });
    world.tick(50);
    world.updatePlayerInput('p1', { x: DOOR.x, y: DOOR.y, yaw: 0, seq: 2 });
    world.tick(100);
    world.updatePlayerInput('p1', { x: INSIDE_TRIGGER.x, y: INSIDE_TRIGGER.y, yaw: 0, seq: 3 });
    world.tick(150);
    world.tick(200); // still inside — must not re-fire

    const snap = world.getSnapshot(4);
    expect(snap.enemies).toHaveLength(initialEnemyCount + triggerSpawnCount);
  });
});
