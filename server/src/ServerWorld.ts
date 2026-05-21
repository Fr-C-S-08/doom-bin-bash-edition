import type { PlayerState, EnemyState } from '../../shared/types.js';
import type { SnapshotMessage, ServerEvent } from '../../shared/protocol.js';
import { tickEnemies, findTargetPlayer } from './EnemySystem.js';
import { DirectorSystem } from './DirectorSystem.js';
import { cloneRaycastEnemies, createRaycastEnemy, type RaycastEnemy } from '../../src/game/raycast/RaycastEnemy.js';
import {
  cloneRaycastMap,
  findRaycastZoneId,
  getRaycastExitAccess,
  getRaycastLevelById,
  isNearPoint,
  openRaycastDoor,
  RAYCAST_LEVEL,
  type RaycastLevel,
} from '../../src/game/raycast/RaycastLevel.js';
import { resolveRaycastNextLevelId } from '../../src/game/raycast/RaycastEpisode.js';
import type { RaycastMap } from '../../src/game/raycast/RaycastMap.js';
import type { SpawnRequest } from '../../src/game/systems/GameDirector.js';
import { findEnemyInCrosshair } from '../../src/game/raycast/RaycastCombatSystem.js';
import { castRay } from '../../src/game/raycast/RaycastMap.js';
import { applyDamage } from '../../src/game/systems/CombatSystem.js';
import { WEAPON_ORDER, getWeaponConfig } from '../../src/game/systems/WeaponConfig.js';
import { TriggerSystem } from '../../src/game/systems/TriggerSystem.js';
import { KeySystem } from '../../src/game/systems/KeySystem.js';
import { DoorSystem } from '../../src/game/systems/DoorSystem.js';
import { RESPAWN_COOLDOWN_MS, TICK_INTERVAL_MS } from '../../shared/constants.js';

export class ServerWorld {
  private readonly playerStates = new Map<string, PlayerState>();
  private readonly pendingEvents: ServerEvent[] = [];

  // Level state — mutated by loadLevel() on level transitions.
  private currentLevel!: RaycastLevel;
  private currentLevelId = '';
  private enemies: RaycastEnemy[] = [];
  private map!: RaycastMap;
  private director!: DirectorSystem;
  private triggerSystem!: TriggerSystem;
  private keySystem!: KeySystem;
  private doorSystem!: DoorSystem;

  private serverTime = 0;
  private currentTick = 0;
  private totalKills = 0;
  private gameOverFired = false;
  // When true, the campaign is finished and no further level transitions occur.
  private sessionComplete = false;
  // Initialized to 0; loadLevel() resets to serverTime so timeSincePlayerDamagedMs
  // starts at 0 for each new level.
  private lastPlayerDamageAt = 0;

  constructor() {
    // serverTime is 0 at construction, so lastPlayerDamageAt will be set to 0.
    this.loadLevel(RAYCAST_LEVEL.id);
  }

  /**
   * Loads a level by ID, resetting all per-level state. Connected players are
   * teleported to the new level's playerStart with full HP.
   * serverTime is NOT reset so the director's timing remains continuous
   * across transitions — the director won't re-enter its initial CALM window.
   */
  loadLevel(levelId: string): void {
    const level = getRaycastLevelById(levelId);
    this.currentLevel = level;
    this.currentLevelId = level.id;

    this.enemies = cloneRaycastEnemies(level);
    // Clone so openRaycastDoor mutations are isolated to this instance.
    this.map = cloneRaycastMap(level.map);
    this.director = new DirectorSystem(level.director.config, level.director.spawnPoints);
    this.keySystem = new KeySystem();
    this.doorSystem = new DoorSystem(this.keySystem);
    this.triggerSystem = new TriggerSystem();

    this.totalKills = 0;
    this.gameOverFired = false;
    // Reset damage timer relative to current serverTime so the director sees
    // 0 ms since last damage at the start of the new level.
    this.lastPlayerDamageAt = this.serverTime;

    // Teleport all connected players to the new start position with full HP.
    for (const player of this.playerStates.values()) {
      player.x = level.playerStart.x;
      player.y = level.playerStart.y;
      player.yaw = level.playerStart.angle;
      player.hp = player.maxHp;
      player.alive = true;
      player.respawnAtTick = undefined;
    }
  }

  /** Current level ID — exposed for tests and the welcome message. */
  getCurrentLevelId(): string {
    return this.currentLevelId;
  }

  addPlayer(id: string, name: string): void {
    this.playerStates.set(id, {
      id,
      name,
      x: this.currentLevel.playerStart.x,
      y: this.currentLevel.playerStart.y,
      yaw: this.currentLevel.playerStart.angle,
      hp: 100,
      maxHp: 100,
      weapon: 1,
      alive: true,
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

    const hit = castRay(this.map, x, y, yaw, yaw);
    const wallDistance = hit.distance;

    const fakePlayer = { x, y, angle: yaw };
    const enemy = findEnemyInCrosshair(
      fakePlayer,
      this.enemies.filter((e) => e.alive),
      wallDistance,
      config.aimToleranceRadians,
    );

    if (enemy) {
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
        p.x = this.currentLevel.playerStart.x;
        p.y = this.currentLevel.playerStart.y;
        p.yaw = this.currentLevel.playerStart.angle;
        p.respawnAtTick = undefined;
      }
    }

    const alivePlayers = players.filter((p) => p.alive);

    // 0a. Detect key pickups by player proximity (server-authoritative).
    for (const key of this.currentLevel.keys) {
      if (this.keySystem.hasKey(key.id)) continue;
      for (const player of alivePlayers) {
        if (isNearPoint(player.x, player.y, key)) {
          this.keySystem.collect(key);
          this.pendingEvents.push({ type: 'event', kind: 'keyPickup', color: key.id, by: player.name });
          break;
        }
      }
    }

    // 0b. Detect door openings by player proximity (server-authoritative).
    const DOOR_INTERACT_RADIUS = 0.78;
    for (const door of this.currentLevel.doors) {
      if (this.doorSystem.isOpen(door.id)) continue;
      for (const player of alivePlayers) {
        if (isNearPoint(player.x, player.y, { x: door.x, y: door.y, radius: DOOR_INTERACT_RADIUS })) {
          const result = this.doorSystem.attemptOpen(door, 0);
          if (result.opened) {
            openRaycastDoor(this.map, door);
            this.pendingEvents.push({ type: 'event', kind: 'doorOpen', id: door.id });
          }
          break;
        }
      }
    }

    // 0c. Process level triggers for every alive player.
    const triggerPoints = alivePlayers.map((p) => ({ x: p.x, y: p.y }));
    for (const trigger of this.currentLevel.triggers) {
      const activated = this.triggerSystem.activateIfEntered(trigger, triggerPoints, {
        isDoorOpen: (id) => this.doorSystem.isOpen(id),
      });
      if (!activated) continue;

      this.director.notifyZoneTrigger(trigger.id, this.serverTime);

      for (const spawn of trigger.spawns) {
        const id = `trigger-${trigger.id}-${this.serverTime.toFixed(0)}-${Math.random().toString(36).slice(2, 6)}`;
        this.enemies.push(createRaycastEnemy({ id, kind: spawn.kind, x: spawn.x, y: spawn.y }));
      }
    }

    // 0d. Detect level exit — check if any alive player reached the exit and
    // all progression conditions are met. Emits levelChange (or levelClear
    // for the final level) and immediately loads the next level so subsequent
    // ticks run in the new level context.
    if (!this.sessionComplete && alivePlayers.length > 0) {
      exitCheck: for (const exit of this.currentLevel.exits) {
        for (const player of alivePlayers) {
          if (!isNearPoint(player.x, player.y, exit)) continue;

          const access = getRaycastExitAccess(this.currentLevel, {
            collectedKeyIds: this.currentLevel.keys
              .filter((k) => this.keySystem.hasKey(k.id))
              .map((k) => k.id),
            openDoorIds: this.currentLevel.doors
              .filter((d) => this.doorSystem.isOpen(d.id))
              .map((d) => d.id),
            activatedTriggerIds: this.currentLevel.triggers
              .filter((t) => this.triggerSystem.hasActivated(t.id))
              .map((t) => t.id),
            livingEnemyCount: this.enemies.filter((e) => e.alive).length,
            // TODO: boss server-side — once the boss runs on the server, derive
            // bossDefeated from real boss state instead of hardcoding true.
            bossDefeated: true,
          });

          if (!access.allowed) continue;

          const nextLevelId = resolveRaycastNextLevelId(this.currentLevelId);

          if (nextLevelId === null) {
            // Final level cleared — campaign complete.
            this.pendingEvents.push({ type: 'event', kind: 'levelClear' });
            this.sessionComplete = true;
          } else {
            this.pendingEvents.push({ type: 'event', kind: 'levelChange', nextLevelId });
            // loadLevel immediately replaces this.currentLevel, so the loop
            // would operate on the new level's data. Break out to avoid that.
            this.loadLevel(nextLevelId);
          }
          break exitCheck;
        }
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
    const sortedByHp = [...players].sort((a, b) => a.hp - b.hp);
    const p1 = sortedByHp[0] ?? null;
    const p2 = sortedByHp[1] ?? null;

    const currentWave = Math.floor(this.totalKills / 3) + 1;

    const activeZoneId =
      p1 && p1.alive ? findRaycastZoneId(this.currentLevel, p1.x, p1.y) : null;

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

  drainEvents(): ServerEvent[] {
    return this.pendingEvents.splice(0);
  }

  getLastPlayerDamageAt(): number {
    return this.lastPlayerDamageAt;
  }

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
      doors: this.currentLevel.doors.map((door) => ({
        id: door.id,
        open: this.doorSystem.isOpen(door.id),
        requiresKey: door.keyId,
      })),
      level: {
        keysCollected: this.currentLevel.keys
          .filter((key) => this.keySystem.hasKey(key.id))
          .map((key) => key.id),
        exitActive: false,
        secretsFound: 0,
      },
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
      state,
    };
  }
}
