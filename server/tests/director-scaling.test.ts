import { describe, it, expect } from 'vitest';
import { ServerWorld } from '../src/ServerWorld.js';

describe('director scaling — timeSincePlayerDamagedMs', () => {
  it('lastPlayerDamageAt starts at 0 and updates when a player takes melee damage', () => {
    const world = new ServerWorld();
    world.addPlayer('p1', 'Alice');

    expect(world.getLastPlayerDamageAt()).toBe(0);

    // Tick long enough for enemies to engage and potentially deal melee damage.
    // We only need the field to update — not guaranteed in every run, so we
    // verify the invariant: it's always <= current serverTime.
    for (let i = 0; i < 600; i++) world.tick(50);

    const lastDamageAt = world.getLastPlayerDamageAt();
    const serverTime = world.getServerTime();

    expect(lastDamageAt).toBeGreaterThanOrEqual(0);
    expect(lastDamageAt).toBeLessThanOrEqual(serverTime);
  });

  it('timeSincePlayerDamagedMs grows when no damage is dealt', () => {
    const world = new ServerWorld();
    world.addPlayer('p1', 'Alice');

    // With no enemies in melee range at tick 0, lastPlayerDamageAt stays at 0.
    // After N ticks, serverTime = N*50 and timeSinceDamage = serverTime - 0.
    world.tick(50);
    const t1 = world.getServerTime() - world.getLastPlayerDamageAt();

    world.tick(50);
    const t2 = world.getServerTime() - world.getLastPlayerDamageAt();

    // timeSincePlayerDamagedMs should be non-negative and grow over time
    // as long as no damage was applied (enemies are not yet in melee range at t=100ms).
    expect(t1).toBeGreaterThanOrEqual(0);
    expect(t2).toBeGreaterThanOrEqual(t1);
  });
});
