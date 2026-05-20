import { describe, expect, it } from 'vitest';
import {
  createRaycastBossState,
  syncRaycastBossPhase,
  tickRaycastBossMovement,
  type RaycastBossConfig
} from '../game/raycast/RaycastBoss';
import {
  BOSS_DESPERATION_HP_RATIO,
  BOSS_PHASE3_SPEED_MUL,
  THIRD_BOSS_FIGHT_LEVEL_ID,
  THIRD_BOSS_FIGHT_SPEED_MULTIPLIER,
  computeBossMovementIntent,
  getBossBaseMoveSpeed,
  getBossIntroCopy,
  isBossDesperation,
  isPlayerKitingBoss,
  pickBossVolleyKind,
  predictPlayerAimPoint,
  resolveBossMoveSpeed,
  tickDualBossCoordination
} from '../game/raycast/RaycastBossAI';
import { RAYCAST_MAP_BOSS } from '../game/raycast/RaycastMap';

const CONFIG: RaycastBossConfig = {
  id: 'volt-archon',
  displayName: 'Volt Archon',
  x: 7.5,
  y: 7.5,
  maxHealth: 120,
  hitRadius: 0.55
};

describe('raycast boss ai', () => {
  it('reduces phase 3 move speed by ~30%', () => {
    const boss = createRaycastBossState(CONFIG, 0);
    boss.phase = 3;
    const base = getBossBaseMoveSpeed(boss);
    const resolved = resolveBossMoveSpeed(boss, 1);
    expect(resolved).toBeCloseTo(base * BOSS_PHASE3_SPEED_MUL, 3);
    expect(resolved).toBeLessThan(base * 0.75);
  });

  it('slows movement 35% on third boss fight only', () => {
    const boss = createRaycastBossState(
      { ...CONFIG, behavior: 'ash-judge' },
      0,
      { arenaLevelId: THIRD_BOSS_FIGHT_LEVEL_ID },
    );
    boss.phase = 2;
    const without = resolveBossMoveSpeed(boss, 1);
    const otherFight = createRaycastBossState({ ...CONFIG, behavior: 'ash-judge' }, 0, {
      arenaLevelId: 'bloom-warden-grove',
    });
    otherFight.phase = 2;
    const baseline = resolveBossMoveSpeed(otherFight, 1);
    expect(without).toBeCloseTo(baseline * THIRD_BOSS_FIGHT_SPEED_MULTIPLIER, 4);
    expect(THIRD_BOSS_FIGHT_SPEED_MULTIPLIER).toBe(0.65);
  });

  it('detects kiting when player moves away', () => {
    const boss = createRaycastBossState(CONFIG, 0);
    const kiting = isPlayerKitingBoss(boss, {
      x: 2.5,
      y: 7.5,
      alive: true,
      vx: -2.2,
      vy: 0
    });
    expect(kiting).toBe(true);
  });

  it('uses cut_angle movement when player kites', () => {
    const boss = createRaycastBossState(CONFIG, 0);
    boss.phase = 2;
    const intent = computeBossMovementIntent(
      boss,
      RAYCAST_MAP_BOSS,
      { x: 2.5, y: 7.5, alive: true, vx: -2, vy: 0 },
      4000,
      1
    );
    expect(intent.mode).toBe('cut_angle');
  });

  it('avoids repeating the same volley twice in a row', () => {
    const boss = createRaycastBossState(CONFIG, 0);
    boss.phase = 2;
    boss.lastVolleyKind = 'bracket';
    const kind = pickBossVolleyKind(boss, {
      distance: 4,
      playerStationary: false,
      playerKiting: false,
      playerCornered: false,
      desperation: false,
      timeSinceLastVolleyMs: 1400
    });
    expect(kind).not.toBe('bracket');
  });

  it('enters desperation below HP threshold', () => {
    const boss = createRaycastBossState(CONFIG, 0);
    boss.health = Math.round(boss.maxHealth * (BOSS_DESPERATION_HP_RATIO - 0.02));
    syncRaycastBossPhase(boss);
    expect(isBossDesperation(boss)).toBe(true);
    const kind = pickBossVolleyKind(boss, {
      distance: 3.2,
      playerStationary: false,
      playerKiting: false,
      playerCornered: false,
      desperation: true,
      timeSinceLastVolleyMs: 900
    });
    expect(['cutoff', 'fan_wide', 'zone_deny', 'cross']).toContain(kind);
  });

  it('predicts player aim ahead of velocity', () => {
    const boss = createRaycastBossState(CONFIG, 0);
    const aim = predictPlayerAimPoint(boss, { x: 2.5, y: 7.5, alive: true, vx: 2, vy: 0 }, 0.2);
    expect(aim.x).toBeGreaterThan(2.5);
  });

  it('coordinates dual bosses with spacing', () => {
    const a = createRaycastBossState({ ...CONFIG, id: 'ash-a', x: 7.4, y: 7.4, behavior: 'ash-judge' }, 0);
    const b = createRaycastBossState({ ...CONFIG, id: 'ash-b', x: 7.45, y: 7.45, behavior: 'ash-judge' }, 0);
    const before = Math.hypot(b.x - a.x, b.y - a.y);
    for (let t = 0; t < 30; t += 1) {
      tickDualBossCoordination([a, b], { x: 2.5, y: 7.5 }, t * 50);
    }
    const after = Math.hypot(b.x - a.x, b.y - a.y);
    expect(after).toBeGreaterThanOrEqual(a.hitRadius + b.hitRadius + 0.9);
    expect(before).toBeLessThan(a.hitRadius + b.hitRadius + 0.5);
  });

  it('exposes boss intro copy per behavior', () => {
    expect(getBossIntroCopy('Volt Archon', 'volt-archon').subtitle).toContain('IÓNICO');
    expect(getBossIntroCopy('Ash Judge', 'ash-judge').subtitle).toContain('SELLO');
  });

  it('still moves during tactical intent without clipping walls', () => {
    const boss = createRaycastBossState(CONFIG, 0);
    const before = { x: boss.x, y: boss.y };
    tickRaycastBossMovement(boss, RAYCAST_MAP_BOSS, { x: 2.5, y: 7.5, alive: true }, 900, 2000);
    expect(Math.hypot(boss.x - before.x, boss.y - before.y)).toBeGreaterThan(0.04);
  });
});
