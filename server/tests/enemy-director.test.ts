import { describe, it, expect } from 'vitest';
import { DirectorSystem } from '../src/DirectorSystem.js';
import { tickEnemies } from '../src/EnemySystem.js';
import { ServerWorld } from '../src/ServerWorld.js';
import { RAYCAST_LEVEL } from '../../src/game/raycast/RaycastLevel.js';
import { createRaycastEnemy } from '../../src/game/raycast/RaycastEnemy.js';
import type { PlayerState } from '../../shared/types.js';

describe('DirectorSystem', () => {
  it('createOpeningSpawns returns an array', () => {
    const director = new DirectorSystem();
    const spawns = director.createOpeningSpawns();
    expect(Array.isArray(spawns)).toBe(true);
  });

  it('update returns a decision with state and intensity', () => {
    const director = new DirectorSystem();
    const decision = director.update({
      elapsedTime: 0,
      totalKills: 0,
      enemiesAlive: 0,
      players: [{ health: 100, alive: true }],
      currentWave: 1
    });
    expect(['CALM', 'WATCHING', 'WARNING', 'PRESSURE', 'AMBUSH', 'RECOVERY']).toContain(decision.state);
    expect(typeof decision.intensity).toBe('number');
  });

  it('returns zero intensity when all players are dead', () => {
    const director = new DirectorSystem();
    const decision = director.update({
      elapsedTime: 0,
      totalKills: 0,
      enemiesAlive: 0,
      players: [{ health: 0, alive: false }],
      currentWave: 1
    });
    expect(decision.intensity).toBe(0);
    expect(decision.spawn).toBeNull();
  });
});

describe('tickEnemies', () => {
  it('runs without error when no players are alive', () => {
    const enemy = createRaycastEnemy(RAYCAST_LEVEL.initialSpawns[0]);
    const result = tickEnemies(RAYCAST_LEVEL.map, [enemy], [], 0, 50);
    expect(typeof result.meleeDamage).toBe('number');
    expect(result.meleeDamage).toBe(0);
    expect(Array.isArray(result.spawnedProjectiles)).toBe(true);
  });

  it('runs without error with an alive player', () => {
    const enemy = createRaycastEnemy(RAYCAST_LEVEL.initialSpawns[0]);
    const players: PlayerState[] = [
      { id: 'p1', name: 'Alice', x: 5, y: 5, yaw: 0, hp: 100, maxHp: 100, weapon: 1, alive: true }
    ];
    const result = tickEnemies(RAYCAST_LEVEL.map, [enemy], players, 0, 50);
    expect(typeof result.meleeDamage).toBe('number');
  });

  it('mutates enemy positions over multiple ticks', () => {
    const enemy = createRaycastEnemy(RAYCAST_LEVEL.initialSpawns[0]);
    const startX = enemy.x;
    const players: PlayerState[] = [
      { id: 'p1', name: 'Alice', x: 10, y: 10, yaw: 0, hp: 100, maxHp: 100, weapon: 1, alive: true }
    ];
    for (let t = 0; t < 20; t++) {
      tickEnemies(RAYCAST_LEVEL.map, [enemy], players, t * 50, 50);
    }
    // After enough ticks, enemy should have moved toward the player
    expect(typeof enemy.x).toBe('number');
    expect(typeof enemy.y).toBe('number');
    expect(enemy.x !== startX || enemy.y !== startX).toBe(true);
  });
});

describe('ServerWorld.tick', () => {
  it('spawns enemies after enough ticks with a player present', () => {
    const world = new ServerWorld();
    world.addPlayer('p1', 'Alice');
    // Tick for 20 seconds — director needs ~13 s before first spawn
    for (let i = 0; i < 400; i++) {
      world.tick(50);
    }
    const snap = world.getSnapshot(400);
    expect(snap.enemies.length).toBeGreaterThan(0);
  });

  it('enemies in snapshot have valid archetype and state fields', () => {
    const world = new ServerWorld();
    world.addPlayer('p1', 'Alice');
    for (let i = 0; i < 400; i++) world.tick(50);
    const snap = world.getSnapshot(400);
    for (const e of snap.enemies) {
      expect(['GRUNT', 'BRUTE', 'STALKER', 'RANGED', 'SCRAMBLER', 'FLASHER']).toContain(e.archetype);
      expect(['SPAWN', 'CHASE', 'ATTACK', 'DEAD']).toContain(e.state);
    }
  });
});
