import type { PlayerState, EnemyState } from '../../shared/types.js';
import type { SnapshotMessage, ServerEvent } from '../../shared/protocol.js';
import { tickEnemies, findTargetPlayer } from './EnemySystem.js';
import { DirectorSystem } from './DirectorSystem.js';
import { cloneRaycastEnemies, createRaycastEnemy, type RaycastEnemy } from '../../src/game/raycast/RaycastEnemy.js';
import { RAYCAST_LEVEL } from '../../src/game/raycast/RaycastLevel.js';
import type { RaycastMap } from '../../src/game/raycast/RaycastMap.js';
import type { SpawnRequest } from '../../src/game/systems/GameDirector.js';
import { findEnemyInCrosshair } from '../../src/game/raycast/RaycastCombatSystem.js';
import { castRay } from '../../src/game/raycast/RaycastMap.js';
import { applyDamage } from '../../src/game/systems/CombatSystem.js';
import { WEAPON_ORDER, getWeaponConfig } from '../../src/game/systems/WeaponConfig.js';
import { RESPAWN_COOLDOWN_MS, TICK_INTERVAL_MS } from '../../shared/constants.js';

export class ServerWorld {
  private readonly playerStates = new Map<string, PlayerState>();
  private readonly enemies: RaycastEnemy[] = cloneRaycastEnemies(RAYCAST_LEVEL);
  private readonly map: RaycastMap = RAYCAST_LEVEL.map;
  private readonly director = new DirectorSystem(
    RAYCAST_LEVEL.director.config,
    RAYCAST_LEVEL.director.spawnPoints
  );
  private serverTime = 0;
  private currentTick = 0;
  private totalKills = 0;
  private gameOverFired = false;
  private readonly pendingEvents: ServerEvent[] = [];

  addPlayer(id: string, name: string): void {
    this.playerStates.set(id, {
      id,
      name,
      x: RAYCAST_LEVEL.playerStart.x,
      y: RAYCAST_LEVEL.playerStart.y,
      yaw: RAYCAST_LEVEL.playerStart.angle,
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

  handleShoot(playerId: string, x: number, y: number, yaw: number, weaponSlot: number): void {
    const player = this.playerStates.get(playerId);
    if (!player?.alive) return;

    if (weaponSlot < 1 || weaponSlot > WEAPON_ORDER.length) {
      console.warn(`[server] shoot from playerId=${playerId} invalid weapon=${weaponSlot}`);
      return;
    }

    const kindIndex = Math.max(0, Math.min(weaponSlot - 1, WEAPON_ORDER.length - 1));
    const weaponKind = WEAPON_ORDER[kindIndex];
    const config = getWeaponConfig(weaponKind, 'raycast');

    // Get wall distance for hitscan range check
    const hit = castRay(this.map, x, y, yaw, yaw);
    const wallDistance = hit.distance;

    // Find enemy in crosshair using server position
    const fakePlayer = { x, y, angle: yaw };
    const enemy = findEnemyInCrosshair(
      fakePlayer,
      this.enemies.filter((e) => e.alive),
      wallDistance,
      config.aimToleranceRadians
    );

    if (enemy) {
      // Server-side hitscan is instantaneous: assume all pellets in the cone
      // connected (best-case approximation). Client's findEnemyInCrosshair
      // already validated the target is in line-of-sight.
      applyDamage(enemy, config.damage * config.pelletCount);
    }
  }

  tick(deltaMs: number): void {
    this.serverTime += deltaMs;
    this.currentTick += 1;
    const players = Array.from(this.playerStates.values());

    // 0. Check for auto-respawn
    const respawnTicks = Math.ceil(RESPAWN_COOLDOWN_MS / TICK_INTERVAL_MS);
    for (const p of players) {
      if (!p.alive && p.respawnAtTick !== undefined && this.currentTick >= p.respawnAtTick) {
        p.hp = p.maxHp;
        p.alive = true;
        p.x = RAYCAST_LEVEL.playerStart.x;
        p.y = RAYCAST_LEVEL.playerStart.y;
        p.yaw = RAYCAST_LEVEL.playerStart.angle;
        p.respawnAtTick = undefined;
      }
    }

    // 1. Run enemy AI — track kills
    const aliveBeforeTick = this.enemies.filter((e) => e.alive).length;
    const result = tickEnemies(this.map, this.enemies, players, this.serverTime, deltaMs);
    const aliveAfterTick = this.enemies.filter((e) => e.alive).length;
    this.totalKills += Math.max(0, aliveBeforeTick - aliveAfterTick);

    // 2. Apply melee damage to the nearest alive player
    if (result.meleeDamage > 0) {
      const target = findTargetPlayer(this.enemies, players);
      if (target) {
        target.hp = Math.max(0, target.hp - result.meleeDamage);
        if (target.hp <= 0) {
          target.alive = false;
          target.respawnAtTick = this.currentTick + respawnTicks;
        }
      }
    }

    // 3. Run director — possibly spawn new enemies
    const decision = this.director.update({
      elapsedTime: this.serverTime,
      totalKills: this.totalKills,
      enemiesAlive: aliveAfterTick,
      players: players.map((p) => ({ health: p.hp, alive: p.alive })),
      currentWave: 1
    });

    if (decision.spawn) this.spawnEnemy(decision.spawn);
    for (const extra of decision.extraSpawns) this.spawnEnemy(extra);

    // 4. Check for game over (all players dead, no pending respawn)
    if (!this.gameOverFired && this.playerStates.size > 0) {
      const allDead = players.every((p) => !p.alive);
      if (allDead) {
        this.gameOverFired = true;
        this.pendingEvents.push({ type: 'event', kind: 'gameOver' });
      }
    }
  }

  /** Returns and clears any events accumulated during the last tick. */
  drainEvents(): ServerEvent[] {
    return this.pendingEvents.splice(0);
  }

  getSnapshot(tick: number): SnapshotMessage {
    return {
      type: 'snapshot',
      tick,
      serverTime: Date.now(),
      players: Array.from(this.playerStates.values()),
      enemies: this.enemies.map((e) => this.toEnemyState(e)),
      projectiles: [],
      items: [],
      doors: [],
      level: { keysCollected: [], exitActive: false, secretsFound: 0 }
    };
  }

  private spawnEnemy(req: SpawnRequest): void {
    const id = `srv-${this.serverTime.toFixed(0)}-${Math.random().toString(36).slice(2, 6)}`;
    const enemy = createRaycastEnemy({ id, kind: req.kind, x: req.x, y: req.y });
    this.enemies.push(enemy);
  }

  private toEnemyState(e: RaycastEnemy): EnemyState {
    let state: EnemyState['state'];
    if (!e.alive) state = 'DEAD';
    else if (e.spawnTelegraphUntil > this.serverTime) state = 'SPAWN';
    else if (e.attackWindupUntil > this.serverTime) state = 'ATTACK';
    else state = 'CHASE';

    return {
      id: e.id,
      archetype: e.kind as EnemyState['archetype'],
      x: e.x,
      y: e.y,
      yaw: 0,
      hp: e.health,
      state
    };
  }
}
