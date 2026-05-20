import type { GameMasterSource } from '../../services/gameMasterClient';
import { formatGameMasterTierHudLabel, type GameMasterNarrationTier } from '../../services/gameMasterNarrationTypes';
import { formatGameMasterVoiceHudLabel } from '../../services/gameMasterVoice';

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
  lastTier?: GameMasterNarrationTier | null;
  lastSource?: GameMasterSource | null;
}): string {
  const activity = resolveGameMasterHudActivity(input.narrationEnabled, input.inFlight);
  const voice = formatGameMasterVoiceHudLabel(input.voiceEnabled);
  const tierSuffix = input.narrationEnabled
    ? ` (${formatGameMasterTierHudLabel(input.lastTier ?? null)})`
    : '';
  const sourceSuffix =
    input.narrationEnabled && input.lastSource ? ` | src ${input.lastSource}` : '';
  return `GM ${activity}${tierSuffix} | voice ${voice}${sourceSuffix}`;
}
