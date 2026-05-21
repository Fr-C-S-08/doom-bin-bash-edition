import { describe, expect, it } from 'vitest';
import { createRaycastNarrationQueueState, enqueueNarrationMessage } from '../game/raycast/RaycastNarration';

describe('narration overlay queue reset', () => {
  it('clearing queue drops active and pending lines', () => {
    let queue = enqueueNarrationMessage(createRaycastNarrationQueueState(), 'Mensaje viejo', 4, 0, 4000, 'ambient');
    expect(queue.active?.message).toBe('Mensaje viejo');
    queue = { pending: [], active: null, queueCooldownUntilMs: 0 };
    expect(queue.active).toBeNull();
    expect(queue.pending).toHaveLength(0);
  });
});
