import {
  buildRaycastCurrentObjective,
  formatRaycastObjectiveHudLabel,
  type RaycastHudObjectiveLabels,
  type RaycastObjectiveState,
} from '../game/raycast/RaycastObjective';

export const GM_OBJECTIVE_REMINDER_COOLDOWN_MS = 2_000;

export function buildGameMasterObjectiveReminderMessage(
  state: RaycastObjectiveState,
  labels?: RaycastHudObjectiveLabels | null,
): string {
  const canonical = buildRaycastCurrentObjective(state);
  const hudLabel = formatRaycastObjectiveHudLabel(canonical, labels);

  if (canonical === 'FIND KEY') {
    if (state.keyTotal > 0 && state.keyCount < state.keyTotal) {
      return `Objetivo actual: consigue la llave de acceso. Fichas ${state.keyCount} de ${state.keyTotal}.`;
    }
    return 'Objetivo actual: consigue la llave de acceso.';
  }

  if (canonical === 'OPEN DOOR') {
    if (state.closedDoorCount > 1) {
      return `Objetivo actual: abre las puertas selladas. Quedan ${state.closedDoorCount}.`;
    }
    return 'Objetivo actual: abre la puerta sellada y desbloquea la ruta.';
  }

  if (canonical === 'SURVIVE AMBUSH') {
    if (state.livingEnemyCount > 0) {
      return `Objetivo actual: elimina a todos los hostiles. Quedan ${state.livingEnemyCount}.`;
    }
    if (state.activatedTriggerCount < state.requiredTriggerCount) {
      const pending = state.requiredTriggerCount - state.activatedTriggerCount;
      return `Objetivo actual: activa los eventos del sector. Pendientes ${pending}.`;
    }
    return 'Objetivo actual: sobrevive la emboscada y limpia el pasillo.';
  }

  if (canonical === 'REACH EXIT') {
    return 'Objetivo actual: alcanza la extracción.';
  }

  if (canonical === 'SECTOR PURGED') {
    return 'Objetivo actual: sector purgado. Avanza o reinicia el ciclo.';
  }

  const normalized = hudLabel.replace(/\s+/g, ' ').trim().toLowerCase();
  if (normalized.length > 0) {
    return `Objetivo actual: ${normalized}.`;
  }

  return 'Objetivo actual: sobrevive y avanza hacia la extracción.';
}
