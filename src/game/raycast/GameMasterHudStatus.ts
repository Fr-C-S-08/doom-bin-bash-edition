import type { GameMasterSource } from '../../services/gameMasterClient';

export type GameMasterHudActivity = 'off' | 'idle' | 'pending';

export function resolveGameMasterHudActivity(
  narrationEnabled: boolean,
  inFlight: boolean,
): GameMasterHudActivity {
  if (!narrationEnabled) return 'off';
  if (inFlight) return 'pending';
  return 'idle';
}

export function formatGameMasterHudStatusLine(input: {
  narrationEnabled: boolean;
  inFlight: boolean;
  voiceEnabled: boolean;
  lastSource?: GameMasterSource | null;
}): string {
  const activity = resolveGameMasterHudActivity(input.narrationEnabled, input.inFlight);
  const voice = input.voiceEnabled ? 'on' : 'off';
  const sourceSuffix =
    input.narrationEnabled && input.lastSource ? ` | src ${input.lastSource}` : '';
  return `GM ${activity} | voice ${voice}${sourceSuffix}`;
}
