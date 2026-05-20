import {
  ensureSessionSettings,
  getGamepadInvertY,
  getGamepadLeftDeadzone,
  getGamepadRightDeadzone,
  getGamepadSensitivity,
  getGamepadVibrationEnabled,
  getMinimapDefaultVisible,
  getMouseSensitivity,
  getScreenshakeEnabled,
  getSessionMasterVolume,
  getTouchButtonScale,
  getTouchControlsEnabled,
  getTouchJoystickDeadzone,
  getTouchLookSensitivity,
  getAimAssistLevel,
  getCameraSmoothing,
  getRaycastFovScale,
  registerSessionSettingsPersistHook,
  SESSION_GAMEPAD_DEADZONE_KEY,
  SESSION_GAMEPAD_INVERT_Y_KEY,
  SESSION_GAMEPAD_LEFT_DEADZONE_KEY,
  SESSION_GAMEPAD_RIGHT_DEADZONE_KEY,
  SESSION_GAMEPAD_SENS_KEY,
  SESSION_GAMEPAD_VIBRATION_KEY,
  SESSION_MASTER_VOLUME_KEY,
  SESSION_MINIMAP_DEFAULT_KEY,
  SESSION_MOUSE_SENS_KEY,
  SESSION_SCREENSHAKE_KEY,
  SESSION_TOUCH_BUTTON_SCALE_KEY,
  SESSION_TOUCH_CONTROLS_KEY,
  SESSION_TOUCH_JOYSTICK_DEADZONE_KEY,
  SESSION_TOUCH_LOOK_SENS_KEY,
  SESSION_AIM_ASSIST_KEY,
  SESSION_CAMERA_SMOOTHING_KEY,
  SESSION_FOV_SCALE_KEY,
  type SessionRegistry
} from '../sessionSettings';
import { getSaveManager } from './SaveManager';
import type { PersistedSettings } from './saveSchema';

function readSettingsFromRegistry(registry: SessionRegistry): PersistedSettings {
  return {
    mouseSensitivity: getMouseSensitivity(registry),
    gamepadSensitivity: getGamepadSensitivity(registry),
    gamepadLeftDeadzone: getGamepadLeftDeadzone(registry),
    gamepadRightDeadzone: getGamepadRightDeadzone(registry),
    gamepadInvertY: getGamepadInvertY(registry),
    gamepadVibration: getGamepadVibrationEnabled(registry),
    screenshake: getScreenshakeEnabled(registry),
    minimapDefaultVisible: getMinimapDefaultVisible(registry),
    masterVolume: getSessionMasterVolume(registry),
    touchControlsEnabled: getTouchControlsEnabled(registry),
    touchLookSensitivity: getTouchLookSensitivity(registry),
    touchButtonScale: getTouchButtonScale(registry),
    touchJoystickDeadzone: getTouchJoystickDeadzone(registry),
    preferFullscreen: getSaveManager().getSettings().preferFullscreen,
    aimAssist: getAimAssistLevel(registry),
    cameraSmoothing: getCameraSmoothing(registry),
    fovScale: getRaycastFovScale(registry)
  };
}

function applySettingsToRegistry(registry: SessionRegistry, settings: PersistedSettings): void {
  registry.set(SESSION_MOUSE_SENS_KEY, settings.mouseSensitivity);
  registry.set(SESSION_GAMEPAD_SENS_KEY, settings.gamepadSensitivity);
  registry.set(SESSION_GAMEPAD_LEFT_DEADZONE_KEY, settings.gamepadLeftDeadzone);
  registry.set(SESSION_GAMEPAD_DEADZONE_KEY, settings.gamepadRightDeadzone);
  registry.set(SESSION_GAMEPAD_RIGHT_DEADZONE_KEY, settings.gamepadRightDeadzone);
  registry.set(SESSION_GAMEPAD_INVERT_Y_KEY, settings.gamepadInvertY);
  registry.set(SESSION_GAMEPAD_VIBRATION_KEY, settings.gamepadVibration);
  registry.set(SESSION_SCREENSHAKE_KEY, settings.screenshake);
  registry.set(SESSION_MINIMAP_DEFAULT_KEY, settings.minimapDefaultVisible);
  registry.set(SESSION_MASTER_VOLUME_KEY, settings.masterVolume);
  registry.set(SESSION_TOUCH_CONTROLS_KEY, settings.touchControlsEnabled);
  registry.set(SESSION_TOUCH_LOOK_SENS_KEY, settings.touchLookSensitivity);
  registry.set(SESSION_TOUCH_BUTTON_SCALE_KEY, settings.touchButtonScale);
  registry.set(SESSION_TOUCH_JOYSTICK_DEADZONE_KEY, settings.touchJoystickDeadzone);
  registry.set(SESSION_AIM_ASSIST_KEY, settings.aimAssist);
  registry.set(SESSION_CAMERA_SMOOTHING_KEY, settings.cameraSmoothing);
  registry.set(SESSION_FOV_SCALE_KEY, settings.fovScale);
}

export function hydrateSessionSettings(registry: SessionRegistry): void {
  const saved = getSaveManager().getSettings();
  applySettingsToRegistry(registry, saved);
  ensureSessionSettings(registry);
}

export function persistSessionSettings(registry: SessionRegistry): void {
  getSaveManager().updateSettings(readSettingsFromRegistry(registry));
}

let sessionPersistenceBound = false;

export function bindSessionSettingsPersistence(registry: SessionRegistry): void {
  if (sessionPersistenceBound) return;
  registerSessionSettingsPersistHook(() => persistSessionSettings(registry));
  sessionPersistenceBound = true;
}

/** Hydrate registry from disk and bind auto-save (idempotent). */
export function prepareGameSession(registry: SessionRegistry): void {
  hydrateSessionSettings(registry);
  bindSessionSettingsPersistence(registry);
}

export function setPreferFullscreenSaved(enabled: boolean): void {
  getSaveManager().updateSettings({ preferFullscreen: enabled });
}
