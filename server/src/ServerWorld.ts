import type { PlayerState, EnemyState } from '../../shared/types.js';
import type { SnapshotMessage, ServerEvent } from '../../shared/protocol.js';
import { tickEnemies, findTargetPlayer } from './EnemySystem.js';
import { DirectorSystem } from './DirectorSystem.js';
import { cloneRaycastEnemies, createRaycastEnemy, type RaycastEnemy } from '../../src/game/raycast/RaycastEnemy.js';
import { findRaycastZoneId, RAYCAST_LEVEL } from '../../src/game/raycast/RaycastLevel.js';
import type { RaycastMap } from '../../src/game/raycast/RaycastMap.js';
import type { SpawnRequest } from '../../src/game/systems/GameDirector.js';
import { findEnemyInCrosshair } from '../../src/game/raycast/RaycastCombatSystem.js';
import { castRay } from '../../src/game/raycast/RaycastMap.js';
import { applyDamage } from '../../src/game/systems/CombatSystem.js';
import { WEAPON_ORDER, getWeaponConfig } from '../../src/game/systems/WeaponConfig.js';
import { TriggerSystem } from '../../src/game/systems/TriggerSystem.js';
import { RESPAWN_COOLDOWN_MS, TICK_INTERVAL_MS } from '../../shared/constants.js';

export class ServerWorld {
  private readonly playerStates = new Map<string, PlayerState>();
  private readonly enemies: RaycastEnemy[] = cloneRaycastEnemies(RAYCAST_LEVEL);
  private readonly map: RaycastMap = RAYCAST_LEVEL.map;
  private readonly director = new DirectorSystem(
    RAYCAST_LEVEL.director.config,
    RAYCAST_LEVEL.director.spawnPoints
  );
  // TriggerSystem tracks which level triggers have fired (once: true semantics).
  // In co-op, the first alive player to enter a trigger zone activates it.
  private readonly triggerSystem = new TriggerSystem();
  private serverTime = 0;
  private currentTick = 0;
  private totalKills = 0;
  private gameOverFired = false;
  private readonly pendingEvents: ServerEvent[] = [];
  // Initialized to 0 so timeSincePlayerDamagedMs grows naturally from game start.
  // The director won't fire dominance escalation until dominanceNoDamageMs (9200ms)
  // have elapsed without any player taking melee damage — identical to single-player
  // behavior where the timer resets on each hit.
  private lastPlayerDamageAt = 0;

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

    // 0b. Process level triggers for every alive player.
    // Co-op semantics: first alive player to enter a trigger zone activates it.
    // TriggerSystem enforces once:true — subsequent players passing through are
    // no-ops. Mirrors the SP logic in RaycastScene.updateLevelState().
    for (const trigger of RAYCAST_LEVEL.triggers) {
      const alivePlayers = players.filter((p) => p.alive);
      const points = alivePlayers.map((p) => ({ x: p.x, y: p.y }));
      const activated = this.triggerSystem.activateIfEntered(trigger, points);
      if (!activated) continue;

      // Notify the director so it enters WARNING → AMBUSH (same as SP).
      this.director.notifyZoneTrigger(trigger.id, this.serverTime);

      // Spawn the authored enemies defined on this trigger.
      for (const spawn of trigger.spawns) {
        const id = `trigger-${trigger.id}-${this.serverTime.toFixed(0)}-${Math.random().toString(36).slice(2, 6)}`;
        this.enemies.push(createRaycastEnemy({ id, kind: spawn.kind, x: spawn.x, y: spawn.y }));
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
        this.lastPlayerDamageAt = this.serverTime;
      }
    }

    // 3. Run director — possibly spawn new enemies.
    // GameDirectorInput uses flat p1/p2 slots (not a players[] array).
    // Strategy: sort alive players by HP ascending so p1 = most threatened.
    // Dead players and empty slots are represented as alive=false, health=0.
    const sortedByHp = [...players].sort((a, b) => a.hp - b.hp);
    const p1 = sortedByHp[0] ?? null;
    const p2 = sortedByHp[1] ?? null;

    // Proxy for currentWave: the server does not track level triggers, so we
    // approximate wave progression via kill count (every 3 kills = +1 wave).
    const currentWave = Math.floor(this.totalKills / 3) + 1;

    // activeZoneId: computed for the most-threatened alive player. Pure
    // geometric lookup — no side effects. Gives the director +1 intensity
    // when players are inside a named zone and activates the WATCHING state.
    const activeZoneId =
      p1 && p1.alive ? findRaycastZoneId(RAYCAST_LEVEL, p1.x, p1.y) : null;

    // aliveEnemyKindCounts: breakdown of living enemies by archetype, used by
    // pickPressureEnsembleKind to select synergistic enemy types in PRESSURE.
    const aliveEnemyKindCounts = this.enemies
      .filter((e) => e.alive)
      .reduce((acc, e) => {
        acc[e.kind] = (acc[e.kind] ?? 0) + 1;
        return acc;
      }, {} as Partial<Record<RaycastEnemy['kind'], number>>);

    const decision = this.director.update({
      elapsedTime: this.serverTime,
      totalKills: this.totalKills,
      enemiesAlive: aliveAfterTick,
      p1Health: p1?.hp ?? 0,
      p2Health: p2?.hp ?? 0,
      p1Alive: p1?.alive ?? false,
      p2Alive: p2?.alive ?? false,
      currentWave,
      timeSincePlayerDamagedMs: this.serverTime - this.lastPlayerDamageAt,
      activeZoneId,
      aliveEnemyKindCounts,
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

  /** Exposed for testing — returns the last server time at which any player took damage. */
  getLastPlayerDamageAt(): number {
    return this.lastPlayerDamageAt;
  }

  /** Exposed for testing — returns current server time. */
  getServerTime(): number {
    return this.serverTime;
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
