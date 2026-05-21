import type { AimAssistLevel } from './raycast/RaycastLookFeel';
import { cycleAimAssistLevel } from './raycast/RaycastLookFeel';
import {
  DEFAULT_FPS_TARGET,
  DEFAULT_RENDER_QUALITY,
  normalizeFpsTarget,
  normalizeMinimapQuality,
  normalizeRenderQuality,
  type FpsTarget,
  type MinimapQualityId,
  type RenderQualityId,
} from './raycast/RaycastPerformanceSettings';

/** Runtime preferences mirrored in Phaser registry; persisted via SaveManager when hooks are bound. */

export const SESSION_MOUSE_SENS_KEY = 'session_mouse_sens';
export const SESSION_GAMEPAD_SENS_KEY = 'session_gamepad_sens';
export const SESSION_GAMEPAD_DEADZONE_KEY = 'session_gamepad_deadzone';
export const SESSION_GAMEPAD_LEFT_DEADZONE_KEY = 'session_gamepad_left_deadzone';
export const SESSION_GAMEPAD_RIGHT_DEADZONE_KEY = 'session_gamepad_right_deadzone';
export const SESSION_GAMEPAD_INVERT_Y_KEY = 'session_gamepad_invert_y';
export const SESSION_GAMEPAD_VIBRATION_KEY = 'session_gamepad_vibration';
export const SESSION_SCREENSHAKE_KEY = 'session_screenshake';
export const SESSION_MINIMAP_DEFAULT_KEY = 'session_minimap_default';
export const SESSION_MASTER_VOLUME_KEY = 'session_master_volume';
export const SESSION_TOUCH_CONTROLS_KEY = 'session_touch_controls';
export const SESSION_TOUCH_LOOK_SENS_KEY = 'session_touch_look_sens';
export const SESSION_TOUCH_BUTTON_SCALE_KEY = 'session_touch_button_scale';
export const SESSION_TOUCH_JOYSTICK_DEADZONE_KEY = 'session_touch_joystick_deadzone';
export const SESSION_AIM_ASSIST_KEY = 'session_aim_assist';
export const SESSION_CAMERA_SMOOTHING_KEY = 'session_camera_smoothing';
export const SESSION_GM_NARRATION_ENABLED_KEY = 'session_gm_narration_enabled';
export const SESSION_GM_VOICE_ENABLED_KEY = 'session_gm_voice_enabled';
export const SESSION_GM_NARRATION_DURATION_KEY = 'session_gm_narration_duration_ms';
export const SESSION_GM_NARRATION_DEBUG_KEY = 'session_gm_narration_debug';
export const SESSION_GM_VOICE_VOLUME_KEY = 'session_gm_voice_volume';
export const SESSION_MINIMAP_QUALITY_KEY = 'session_minimap_quality';
export const SESSION_FPS_TARGET_KEY = 'session_fps_target';
export const SESSION_RENDER_QUALITY_KEY = 'session_render_quality';

export interface SessionRegistry {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
}

const DEFAULT_MOUSE_SENS = 1;
const DEFAULT_GAMEPAD_SENS = 1;
const DEFAULT_GAMEPAD_DEADZONE = 0.18;
const DEFAULT_GAMEPAD_LEFT_DEADZONE = DEFAULT_GAMEPAD_DEADZONE;
const DEFAULT_GAMEPAD_RIGHT_DEADZONE = DEFAULT_GAMEPAD_DEADZONE;
const DEFAULT_GAMEPAD_INVERT_Y = false;
const DEFAULT_GAMEPAD_VIBRATION = false;
const DEFAULT_SCREENSHAKE = true;
const DEFAULT_MINIMAP = true;
const DEFAULT_MASTER_VOL = 0.85;
const DEFAULT_TOUCH_CONTROLS = true;
const DEFAULT_TOUCH_LOOK_SENS = 1;
const DEFAULT_TOUCH_BUTTON_SCALE = 1;
const DEFAULT_TOUCH_JOYSTICK_DEADZONE = 0.18;
const DEFAULT_AIM_ASSIST: AimAssistLevel = 'low';
const DEFAULT_CAMERA_SMOOTHING = 0.2;
const DEFAULT_GM_NARRATION_ENABLED = true;
const DEFAULT_GM_VOICE_ENABLED = false;
const DEFAULT_GM_VOICE_VOLUME = 1;
const DEFAULT_GM_NARRATION_DURATION_MS = 5_200;
const GM_NARRATION_DURATION_MIN_MS = 4_000;
const GM_NARRATION_DURATION_MAX_MS = 6_000;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export function ensureSessionSettings(registry: SessionRegistry): void {
  if (registry.get(SESSION_MOUSE_SENS_KEY) === undefined) registry.set(SESSION_MOUSE_SENS_KEY, DEFAULT_MOUSE_SENS);
  if (registry.get(SESSION_GAMEPAD_SENS_KEY) === undefined) registry.set(SESSION_GAMEPAD_SENS_KEY, DEFAULT_GAMEPAD_SENS);
  if (registry.get(SESSION_GAMEPAD_DEADZONE_KEY) === undefined) registry.set(SESSION_GAMEPAD_DEADZONE_KEY, DEFAULT_GAMEPAD_RIGHT_DEADZONE);
  if (registry.get(SESSION_GAMEPAD_LEFT_DEADZONE_KEY) === undefined) registry.set(SESSION_GAMEPAD_LEFT_DEADZONE_KEY, DEFAULT_GAMEPAD_LEFT_DEADZONE);
  if (registry.get(SESSION_GAMEPAD_RIGHT_DEADZONE_KEY) === undefined) registry.set(SESSION_GAMEPAD_RIGHT_DEADZONE_KEY, DEFAULT_GAMEPAD_RIGHT_DEADZONE);
  if (registry.get(SESSION_GAMEPAD_INVERT_Y_KEY) === undefined) registry.set(SESSION_GAMEPAD_INVERT_Y_KEY, DEFAULT_GAMEPAD_INVERT_Y);
  if (registry.get(SESSION_GAMEPAD_VIBRATION_KEY) === undefined) registry.set(SESSION_GAMEPAD_VIBRATION_KEY, DEFAULT_GAMEPAD_VIBRATION);
  if (registry.get(SESSION_SCREENSHAKE_KEY) === undefined) registry.set(SESSION_SCREENSHAKE_KEY, DEFAULT_SCREENSHAKE);
  if (registry.get(SESSION_MINIMAP_DEFAULT_KEY) === undefined) registry.set(SESSION_MINIMAP_DEFAULT_KEY, DEFAULT_MINIMAP);
  if (registry.get(SESSION_MASTER_VOLUME_KEY) === undefined) registry.set(SESSION_MASTER_VOLUME_KEY, DEFAULT_MASTER_VOL);
  if (registry.get(SESSION_TOUCH_CONTROLS_KEY) === undefined) registry.set(SESSION_TOUCH_CONTROLS_KEY, DEFAULT_TOUCH_CONTROLS);
  if (registry.get(SESSION_TOUCH_LOOK_SENS_KEY) === undefined) registry.set(SESSION_TOUCH_LOOK_SENS_KEY, DEFAULT_TOUCH_LOOK_SENS);
  if (registry.get(SESSION_TOUCH_BUTTON_SCALE_KEY) === undefined) registry.set(SESSION_TOUCH_BUTTON_SCALE_KEY, DEFAULT_TOUCH_BUTTON_SCALE);
  if (registry.get(SESSION_TOUCH_JOYSTICK_DEADZONE_KEY) === undefined) registry.set(SESSION_TOUCH_JOYSTICK_DEADZONE_KEY, DEFAULT_TOUCH_JOYSTICK_DEADZONE);
  if (registry.get(SESSION_AIM_ASSIST_KEY) === undefined) registry.set(SESSION_AIM_ASSIST_KEY, DEFAULT_AIM_ASSIST);
  if (registry.get(SESSION_CAMERA_SMOOTHING_KEY) === undefined) registry.set(SESSION_CAMERA_SMOOTHING_KEY, DEFAULT_CAMERA_SMOOTHING);
  if (registry.get(SESSION_GM_NARRATION_ENABLED_KEY) === undefined) {
    registry.set(SESSION_GM_NARRATION_ENABLED_KEY, DEFAULT_GM_NARRATION_ENABLED);
  }
  if (registry.get(SESSION_GM_NARRATION_DURATION_KEY) === undefined) {
    registry.set(SESSION_GM_NARRATION_DURATION_KEY, DEFAULT_GM_NARRATION_DURATION_MS);
  }
  if (registry.get(SESSION_GM_VOICE_ENABLED_KEY) === undefined) {
    registry.set(SESSION_GM_VOICE_ENABLED_KEY, DEFAULT_GM_VOICE_ENABLED);
  }
  if (registry.get(SESSION_GM_NARRATION_DEBUG_KEY) === undefined) registry.set(SESSION_GM_NARRATION_DEBUG_KEY, false);
  if (registry.get(SESSION_GM_VOICE_VOLUME_KEY) === undefined) {
    registry.set(SESSION_GM_VOICE_VOLUME_KEY, DEFAULT_GM_VOICE_VOLUME);
  }
  if (registry.get(SESSION_MINIMAP_QUALITY_KEY) === undefined) {
    registry.set(SESSION_MINIMAP_QUALITY_KEY, DEFAULT_RENDER_QUALITY);
  }
  if (registry.get(SESSION_FPS_TARGET_KEY) === undefined) registry.set(SESSION_FPS_TARGET_KEY, DEFAULT_FPS_TARGET);
  if (registry.get(SESSION_RENDER_QUALITY_KEY) === undefined) {
    registry.set(SESSION_RENDER_QUALITY_KEY, DEFAULT_RENDER_QUALITY);
  }
}

export function getGameMasterNarrationEnabled(registry: SessionRegistry): boolean {
  const v = registry.get(SESSION_GM_NARRATION_ENABLED_KEY);
  if (v === false) return false;
  return true;
}

export function setGameMasterNarrationEnabled(registry: SessionRegistry, enabled: boolean): void {
  registry.set(SESSION_GM_NARRATION_ENABLED_KEY, enabled);
  notifySessionSettingsPersist();
}

export function getGameMasterVoiceEnabled(registry: SessionRegistry): boolean {
  return registry.get(SESSION_GM_VOICE_ENABLED_KEY) === true;
}

export function setGameMasterVoiceEnabled(registry: SessionRegistry, enabled: boolean): void {
  registry.set(SESSION_GM_VOICE_ENABLED_KEY, Boolean(enabled));
  notifySessionSettingsPersist();
}

export function getGameMasterNarrationDurationMs(registry: SessionRegistry): number {
  const v = Number(registry.get(SESSION_GM_NARRATION_DURATION_KEY));
  if (!Number.isFinite(v)) return DEFAULT_GM_NARRATION_DURATION_MS;
  return clamp(v, GM_NARRATION_DURATION_MIN_MS, GM_NARRATION_DURATION_MAX_MS);
}

export function setGameMasterNarrationDurationMs(registry: SessionRegistry, ms: number): void {
  registry.set(SESSION_GM_NARRATION_DURATION_KEY, clamp(ms, GM_NARRATION_DURATION_MIN_MS, GM_NARRATION_DURATION_MAX_MS));
  notifySessionSettingsPersist();
}

export function getGameMasterNarrationDebug(registry: SessionRegistry): boolean {
  return registry.get(SESSION_GM_NARRATION_DEBUG_KEY) === true;
}

export function setGameMasterNarrationDebug(registry: SessionRegistry, enabled: boolean): void {
  registry.set(SESSION_GM_NARRATION_DEBUG_KEY, enabled);
  notifySessionSettingsPersist();
}

export function getGameMasterVoiceVolume(registry: SessionRegistry): number {
  const v = Number(registry.get(SESSION_GM_VOICE_VOLUME_KEY));
  if (!Number.isFinite(v)) return DEFAULT_GM_VOICE_VOLUME;
  return clamp(v, 0, 1);
}

export function setGameMasterVoiceVolume(registry: SessionRegistry, volume: number): void {
  registry.set(SESSION_GM_VOICE_VOLUME_KEY, clamp(volume, 0, 1));
  notifySessionSettingsPersist();
}

export function adjustGameMasterVoiceVolume(registry: SessionRegistry, delta: number): number {
  const next = getGameMasterVoiceVolume(registry) + delta;
  setGameMasterVoiceVolume(registry, next);
  return getGameMasterVoiceVolume(registry);
}

export function getMinimapQuality(registry: SessionRegistry): MinimapQualityId {
  return normalizeMinimapQuality(registry.get(SESSION_MINIMAP_QUALITY_KEY));
}

export function setMinimapQuality(registry: SessionRegistry, quality: MinimapQualityId): void {
  registry.set(SESSION_MINIMAP_QUALITY_KEY, normalizeMinimapQuality(quality));
  notifySessionSettingsPersist();
}

export function getFpsTarget(registry: SessionRegistry): FpsTarget {
  return normalizeFpsTarget(registry.get(SESSION_FPS_TARGET_KEY));
}

export function setFpsTarget(registry: SessionRegistry, target: FpsTarget): void {
  registry.set(SESSION_FPS_TARGET_KEY, normalizeFpsTarget(target));
  notifySessionSettingsPersist();
}

export function getRenderQuality(registry: SessionRegistry): RenderQualityId {
  return normalizeRenderQuality(registry.get(SESSION_RENDER_QUALITY_KEY));
}

export function setRenderQuality(registry: SessionRegistry, quality: RenderQualityId): void {
  registry.set(SESSION_RENDER_QUALITY_KEY, normalizeRenderQuality(quality));
  notifySessionSettingsPersist();
}

export function getMouseSensitivity(registry: SessionRegistry): number {
  const v = Number(registry.get(SESSION_MOUSE_SENS_KEY));
  if (!Number.isFinite(v)) return DEFAULT_MOUSE_SENS;
  return clamp(v, 0.35, 2.25);
}

export function setMouseSensitivity(registry: SessionRegistry, value: number): void {
  registry.set(SESSION_MOUSE_SENS_KEY, clamp(value, 0.35, 2.25));
  notifySessionSettingsPersist();
}

export function getGamepadSensitivity(registry: SessionRegistry): number {
  const v = Number(registry.get(SESSION_GAMEPAD_SENS_KEY));
  if (!Number.isFinite(v)) return DEFAULT_GAMEPAD_SENS;
  return clamp(v, 0.35, 2.25);
}

export function setGamepadSensitivity(registry: SessionRegistry, value: number): void {
  registry.set(SESSION_GAMEPAD_SENS_KEY, clamp(value, 0.35, 2.25));
  notifySessionSettingsPersist();
}

export function getGamepadDeadzone(registry: SessionRegistry): number {
  return getGamepadRightDeadzone(registry);
}

export function getGamepadLeftDeadzone(registry: SessionRegistry): number {
  const raw = registry.get(SESSION_GAMEPAD_LEFT_DEADZONE_KEY);
  const v = Number(raw);
  if (!Number.isFinite(v)) return DEFAULT_GAMEPAD_LEFT_DEADZONE;
  return clamp(v, 0.05, 0.4);
}

export function setGamepadLeftDeadzone(registry: SessionRegistry, value: number): void {
  registry.set(SESSION_GAMEPAD_LEFT_DEADZONE_KEY, clamp(value, 0.05, 0.4));
  notifySessionSettingsPersist();
}

export function getGamepadRightDeadzone(registry: SessionRegistry): number {
  const v = Number(registry.get(SESSION_GAMEPAD_DEADZONE_KEY));
  if (Number.isFinite(v)) return clamp(v, 0.05, 0.4);
  const fallback = Number(registry.get(SESSION_GAMEPAD_RIGHT_DEADZONE_KEY));
  if (!Number.isFinite(fallback)) return DEFAULT_GAMEPAD_RIGHT_DEADZONE;
  return clamp(fallback, 0.05, 0.4);
}

export function setGamepadRightDeadzone(registry: SessionRegistry, value: number): void {
  const clamped = clamp(value, 0.05, 0.4);
  registry.set(SESSION_GAMEPAD_DEADZONE_KEY, clamped);
  registry.set(SESSION_GAMEPAD_RIGHT_DEADZONE_KEY, clamped);
  notifySessionSettingsPersist();
}

export function setGamepadDeadzone(registry: SessionRegistry, value: number): void {
  setGamepadRightDeadzone(registry, value);
}

export function getGamepadInvertY(registry: SessionRegistry): boolean {
  const v = registry.get(SESSION_GAMEPAD_INVERT_Y_KEY);
  return v === true;
}

export function setGamepadInvertY(registry: SessionRegistry, enabled: boolean): void {
  registry.set(SESSION_GAMEPAD_INVERT_Y_KEY, Boolean(enabled));
  notifySessionSettingsPersist();
}

export function getGamepadVibrationEnabled(registry: SessionRegistry): boolean {
  const v = registry.get(SESSION_GAMEPAD_VIBRATION_KEY);
  return v === true;
}

export function setGamepadVibrationEnabled(registry: SessionRegistry, enabled: boolean): void {
  registry.set(SESSION_GAMEPAD_VIBRATION_KEY, Boolean(enabled));
  notifySessionSettingsPersist();
}

export function getScreenshakeEnabled(registry: SessionRegistry): boolean {
  const v = registry.get(SESSION_SCREENSHAKE_KEY);
  return v !== false;
}

export function setScreenshakeEnabled(registry: SessionRegistry, enabled: boolean): void {
  registry.set(SESSION_SCREENSHAKE_KEY, Boolean(enabled));
  notifySessionSettingsPersist();
}

export function getMinimapDefaultVisible(registry: SessionRegistry): boolean {
  const v = registry.get(SESSION_MINIMAP_DEFAULT_KEY);
  return v !== false;
}

export function setMinimapDefaultVisible(registry: SessionRegistry, visible: boolean): void {
  registry.set(SESSION_MINIMAP_DEFAULT_KEY, Boolean(visible));
  notifySessionSettingsPersist();
}

export function getSessionMasterVolume(registry: SessionRegistry): number {
  const v = Number(registry.get(SESSION_MASTER_VOLUME_KEY));
  if (!Number.isFinite(v)) return DEFAULT_MASTER_VOL;
  return clamp(v, 0, 1);
}

export function setSessionMasterVolume(registry: SessionRegistry, linear: number): void {
  registry.set(SESSION_MASTER_VOLUME_KEY, clamp(linear, 0, 1));
  notifySessionSettingsPersist();
}

export function getTouchControlsEnabled(registry: SessionRegistry): boolean {
  const v = registry.get(SESSION_TOUCH_CONTROLS_KEY);
  return v !== false;
}

export function setTouchControlsEnabled(registry: SessionRegistry, enabled: boolean): void {
  registry.set(SESSION_TOUCH_CONTROLS_KEY, Boolean(enabled));
  notifySessionSettingsPersist();
}

export function getTouchLookSensitivity(registry: SessionRegistry): number {
  const v = Number(registry.get(SESSION_TOUCH_LOOK_SENS_KEY));
  if (!Number.isFinite(v)) return DEFAULT_TOUCH_LOOK_SENS;
  return clamp(v, 0.45, 2.2);
}

export function setTouchLookSensitivity(registry: SessionRegistry, value: number): void {
  registry.set(SESSION_TOUCH_LOOK_SENS_KEY, clamp(value, 0.45, 2.2));
  notifySessionSettingsPersist();
}

export function getTouchButtonScale(registry: SessionRegistry): number {
  const v = Number(registry.get(SESSION_TOUCH_BUTTON_SCALE_KEY));
  if (!Number.isFinite(v)) return DEFAULT_TOUCH_BUTTON_SCALE;
  return clamp(v, 0.8, 1.4);
}

export function setTouchButtonScale(registry: SessionRegistry, value: number): void {
  registry.set(SESSION_TOUCH_BUTTON_SCALE_KEY, clamp(value, 0.8, 1.4));
  notifySessionSettingsPersist();
}

export function getTouchJoystickDeadzone(registry: SessionRegistry): number {
  const v = Number(registry.get(SESSION_TOUCH_JOYSTICK_DEADZONE_KEY));
  if (!Number.isFinite(v)) return DEFAULT_TOUCH_JOYSTICK_DEADZONE;
  return clamp(v, 0.05, 0.4);
}

export function setTouchJoystickDeadzone(registry: SessionRegistry, value: number): void {
  registry.set(SESSION_TOUCH_JOYSTICK_DEADZONE_KEY, clamp(value, 0.05, 0.4));
  notifySessionSettingsPersist();
}

export function getAimAssistLevel(registry: SessionRegistry): AimAssistLevel {
  const v = registry.get(SESSION_AIM_ASSIST_KEY);
  if (v === 'off' || v === 'low' || v === 'normal') return v;
  return DEFAULT_AIM_ASSIST;
}

export function setAimAssistLevel(registry: SessionRegistry, level: AimAssistLevel): void {
  registry.set(SESSION_AIM_ASSIST_KEY, level);
  notifySessionSettingsPersist();
}

export function cycleAimAssistSetting(registry: SessionRegistry, direction: number): AimAssistLevel {
  const next = cycleAimAssistLevel(getAimAssistLevel(registry), direction);
  setAimAssistLevel(registry, next);
  return next;
}

export function getCameraSmoothing(registry: SessionRegistry): number {
  const v = Number(registry.get(SESSION_CAMERA_SMOOTHING_KEY));
  if (!Number.isFinite(v)) return DEFAULT_CAMERA_SMOOTHING;
  return clamp(v, 0, 0.85);
}

export function setCameraSmoothing(registry: SessionRegistry, value: number): void {
  registry.set(SESSION_CAMERA_SMOOTHING_KEY, clamp(value, 0, 0.85));
  notifySessionSettingsPersist();
}

let sessionSettingsPersistHook: (() => void) | null = null;

export function registerSessionSettingsPersistHook(hook: () => void): void {
  sessionSettingsPersistHook = hook;
}

function notifySessionSettingsPersist(): void {
  sessionSettingsPersistHook?.();
}
