/** Session-only preferences (Phaser registry). No localStorage — survives scene changes within one page load. */

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
}

export function getMouseSensitivity(registry: SessionRegistry): number {
  const v = Number(registry.get(SESSION_MOUSE_SENS_KEY));
  if (!Number.isFinite(v)) return DEFAULT_MOUSE_SENS;
  return clamp(v, 0.35, 2.25);
}

export function setMouseSensitivity(registry: SessionRegistry, value: number): void {
  registry.set(SESSION_MOUSE_SENS_KEY, clamp(value, 0.35, 2.25));
}

export function getGamepadSensitivity(registry: SessionRegistry): number {
  const v = Number(registry.get(SESSION_GAMEPAD_SENS_KEY));
  if (!Number.isFinite(v)) return DEFAULT_GAMEPAD_SENS;
  return clamp(v, 0.35, 2.25);
}

export function setGamepadSensitivity(registry: SessionRegistry, value: number): void {
  registry.set(SESSION_GAMEPAD_SENS_KEY, clamp(value, 0.35, 2.25));
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
}

export function getGamepadVibrationEnabled(registry: SessionRegistry): boolean {
  const v = registry.get(SESSION_GAMEPAD_VIBRATION_KEY);
  return v === true;
}

export function setGamepadVibrationEnabled(registry: SessionRegistry, enabled: boolean): void {
  registry.set(SESSION_GAMEPAD_VIBRATION_KEY, Boolean(enabled));
}

export function getScreenshakeEnabled(registry: SessionRegistry): boolean {
  const v = registry.get(SESSION_SCREENSHAKE_KEY);
  return v !== false;
}

export function setScreenshakeEnabled(registry: SessionRegistry, enabled: boolean): void {
  registry.set(SESSION_SCREENSHAKE_KEY, Boolean(enabled));
}

export function getMinimapDefaultVisible(registry: SessionRegistry): boolean {
  const v = registry.get(SESSION_MINIMAP_DEFAULT_KEY);
  return v !== false;
}

export function setMinimapDefaultVisible(registry: SessionRegistry, visible: boolean): void {
  registry.set(SESSION_MINIMAP_DEFAULT_KEY, Boolean(visible));
}

export function getSessionMasterVolume(registry: SessionRegistry): number {
  const v = Number(registry.get(SESSION_MASTER_VOLUME_KEY));
  if (!Number.isFinite(v)) return DEFAULT_MASTER_VOL;
  return clamp(v, 0, 1);
}

export function setSessionMasterVolume(registry: SessionRegistry, linear: number): void {
  registry.set(SESSION_MASTER_VOLUME_KEY, clamp(linear, 0, 1));
}
