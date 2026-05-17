import type { PlayerState, EnemyState } from '../../shared/types.js';
import type { SnapshotMessage } from '../../shared/protocol.js';
import { tickEnemies } from './EnemySystem.js';
import { DirectorSystem } from './DirectorSystem.js';
import { createRaycastEnemy, type RaycastEnemy } from '../../src/game/raycast/RaycastEnemy.js';
import { RAYCAST_LEVEL } from '../../src/game/raycast/RaycastLevel.js';
import type { RaycastMap } from '../../src/game/raycast/RaycastMap.js';
import type { SpawnRequest } from '../../src/game/systems/GameDirector.js';

export class ServerWorld {
  private readonly playerStates = new Map<string, PlayerState>();
  private readonly enemies: RaycastEnemy[] = [];
  private readonly map: RaycastMap = RAYCAST_LEVEL.map;
  private readonly director = new DirectorSystem(
    RAYCAST_LEVEL.director.config,
    RAYCAST_LEVEL.director.spawnPoints
  );
  private serverTime = 0;
  private totalKills = 0;
  private targetPlayerId: string | null = null;

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
    // First player becomes the initial melee target
    if (!this.targetPlayerId) this.targetPlayerId = id;
  }

  removePlayer(id: string): void {
    this.playerStates.delete(id);
    if (this.targetPlayerId === id) {
      this.targetPlayerId = this.playerStates.keys().next().value ?? null;
    }
  }

  updatePlayerInput(id: string, input: { x: number; y: number; yaw: number; seq: number }): void {
    const player = this.playerStates.get(id);
    if (!player) return;
    player.x = input.x;
    player.y = input.y;
    player.yaw = input.yaw;
  }

  tick(deltaMs: number): void {
    this.serverTime += deltaMs;
    const players = Array.from(this.playerStates.values());

    // 1. Run enemy AI — track kills
    const aliveBeforeTick = this.enemies.filter((e) => e.alive).length;
    const result = tickEnemies(this.map, this.enemies, players, this.serverTime, deltaMs);
    const aliveAfterTick = this.enemies.filter((e) => e.alive).length;
    this.totalKills += Math.max(0, aliveBeforeTick - aliveAfterTick);

    // 2. Apply melee damage to the target player
    if (result.meleeDamage > 0) {
      const target = this.targetPlayerId ? this.playerStates.get(this.targetPlayerId) : null;
      if (target?.alive) {
        target.hp = Math.max(0, target.hp - result.meleeDamage);
        if (target.hp <= 0) target.alive = false;
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
