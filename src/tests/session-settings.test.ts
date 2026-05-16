import { describe, expect, it } from 'vitest';
import {
  ensureSessionSettings,
  getGamepadDeadzone,
  getGamepadSensitivity,
  getGamepadVibrationEnabled,
  getMinimapDefaultVisible,
  getMouseSensitivity,
  getScreenshakeEnabled,
  getSessionMasterVolume,
  SESSION_GAMEPAD_DEADZONE_KEY,
  SESSION_GAMEPAD_SENS_KEY,
  SESSION_GAMEPAD_VIBRATION_KEY,
  SESSION_MASTER_VOLUME_KEY,
  SESSION_MINIMAP_DEFAULT_KEY,
  SESSION_MOUSE_SENS_KEY,
  SESSION_SCREENSHAKE_KEY,
  setGamepadDeadzone,
  setGamepadSensitivity,
  setGamepadVibrationEnabled,
  setMinimapDefaultVisible,
  setMouseSensitivity,
  setScreenshakeEnabled,
  setSessionMasterVolume,
  type SessionRegistry
} from '../game/sessionSettings';

function mockRegistry(initial: Record<string, unknown> = {}): SessionRegistry {
  const store = { ...initial };
  return {
    get: (k: string) => store[k],
    set: (k: string, v: unknown) => {
      store[k] = v;
    }
  };
}

describe('session registry settings', () => {
  it('seeds defaults once and clamps mouse, volume, and booleans', () => {
    const r = mockRegistry();
    ensureSessionSettings(r);
    expect(getMouseSensitivity(r)).toBe(1);
    expect(getSessionMasterVolume(r)).toBeCloseTo(0.85);
    expect(getGamepadSensitivity(r)).toBe(1);
    expect(getGamepadDeadzone(r)).toBeCloseTo(0.18);
    expect(getGamepadVibrationEnabled(r)).toBe(false);
    expect(getScreenshakeEnabled(r)).toBe(true);
    expect(getMinimapDefaultVisible(r)).toBe(true);

    setMouseSensitivity(r, 9);
    expect(getMouseSensitivity(r)).toBe(2.25);
    setMouseSensitivity(r, 0.1);
    expect(getMouseSensitivity(r)).toBe(0.35);

    setSessionMasterVolume(r, -1);
    expect(getSessionMasterVolume(r)).toBe(0);
    setSessionMasterVolume(r, 2);
    expect(getSessionMasterVolume(r)).toBe(1);

    setScreenshakeEnabled(r, false);
    expect(getScreenshakeEnabled(r)).toBe(false);
    setMinimapDefaultVisible(r, false);
    expect(getMinimapDefaultVisible(r)).toBe(false);

    setGamepadSensitivity(r, 9);
    expect(getGamepadSensitivity(r)).toBe(2.25);
    setGamepadSensitivity(r, 0.1);
    expect(getGamepadSensitivity(r)).toBe(0.35);

    setGamepadDeadzone(r, 0.01);
    expect(getGamepadDeadzone(r)).toBe(0.05);
    setGamepadDeadzone(r, 1);
    expect(getGamepadDeadzone(r)).toBe(0.4);

    setGamepadVibrationEnabled(r, true);
    expect(getGamepadVibrationEnabled(r)).toBe(true);
  });

  it('does not overwrite explicit registry values', () => {
    const r = mockRegistry({
      [SESSION_MOUSE_SENS_KEY]: 1.4,
      [SESSION_GAMEPAD_SENS_KEY]: 1.2,
      [SESSION_GAMEPAD_DEADZONE_KEY]: 0.2,
      [SESSION_GAMEPAD_VIBRATION_KEY]: true,
      [SESSION_MASTER_VOLUME_KEY]: 0.4,
      [SESSION_SCREENSHAKE_KEY]: false,
      [SESSION_MINIMAP_DEFAULT_KEY]: false
    });
    ensureSessionSettings(r);
    expect(getMouseSensitivity(r)).toBe(1.4);
    expect(getGamepadSensitivity(r)).toBe(1.2);
    expect(getGamepadDeadzone(r)).toBe(0.2);
    expect(getGamepadVibrationEnabled(r)).toBe(true);
    expect(getSessionMasterVolume(r)).toBeCloseTo(0.4);
    expect(getScreenshakeEnabled(r)).toBe(false);
    expect(getMinimapDefaultVisible(r)).toBe(false);
  });
});
