import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chunkVoiceSpeakText,
  formatGameMasterVoiceHudLabel,
  GM_VOICE_PITCH,
  GM_VOICE_RATE,
  getGameMasterVoiceTestPhrase,
  pickPreferredMasculineSpeechVoice,
  resetGameMasterVoiceStateForTests,
  sanitizeVoiceSpeakText,
  scoreMasculineSpeechVoice,
  speakGameMasterVoice,
  stopGameMasterVoice,
  stripGameMasterVoicePrefixes,
} from '../services/gameMasterVoice';

describe('game master voice', () => {
  afterEach(() => {
    resetGameMasterVoiceStateForTests();
  });

  it('exposes a short test phrase', () => {
    expect(getGameMasterVoiceTestPhrase().length).toBeGreaterThan(10);
  });

  it('cleans GM prefixes and chunks long lines', () => {
    expect(stripGameMasterVoicePrefixes('[GAME MASTER] Canal activo.')).toBe('Canal activo.');
    expect(sanitizeVoiceSpeakText('eco   ## militar')).toBe('eco militar');
    const chunks = chunkVoiceSpeakText(
      'Primera oración extensa. Segunda oración con más detalle táctico para la radio del operador.',
      40,
    );
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('prefers masculine es-MX voice when available', () => {
    const voices = [
      { lang: 'en-US', name: 'Alex', default: false, voiceURI: 'en', localService: true } as SpeechSynthesisVoice,
      { lang: 'es-MX', name: 'Paulina', default: false, voiceURI: 'mx-f', localService: true } as SpeechSynthesisVoice,
      { lang: 'es-MX', name: 'Jorge', default: false, voiceURI: 'mx-m', localService: true } as SpeechSynthesisVoice,
    ];
    expect(scoreMasculineSpeechVoice(voices[2], 'es-MX')).toBeGreaterThan(scoreMasculineSpeechVoice(voices[1], 'es-MX'));
    expect(pickPreferredMasculineSpeechVoice(voices)?.name).toBe('Jorge');
  });

  it('reports unsupported when speechSynthesis is missing', () => {
    const original = globalThis.speechSynthesis;
    Object.defineProperty(globalThis, 'speechSynthesis', { value: undefined, configurable: true });
    expect(speakGameMasterVoice('hola')).toBe('unsupported');
    Object.defineProperty(globalThis, 'speechSynthesis', { value: original, configurable: true });
  });

  it('uses human pacing rate and lower pitch', () => {
    expect(GM_VOICE_RATE).toBeGreaterThanOrEqual(1.05);
    expect(GM_VOICE_RATE).toBeLessThanOrEqual(1.12);
    expect(GM_VOICE_PITCH).toBeGreaterThanOrEqual(0.65);
    expect(GM_VOICE_PITCH).toBeLessThanOrEqual(0.78);
  });

  it('stopGameMasterVoice cancels speechSynthesis', () => {
    const cancel = vi.fn();
    Object.defineProperty(globalThis, 'speechSynthesis', {
      value: { speak: vi.fn(), cancel, getVoices: () => [] } as unknown as SpeechSynthesis,
      configurable: true,
    });
    stopGameMasterVoice('player_death');
    expect(cancel).toHaveBeenCalled();
  });

  it('uses Web Speech API when available', () => {
    const speak = vi.fn();
    const cancel = vi.fn();
    class MockUtterance {
      rate = 1;
      pitch = 1;
      volume = 1;
      lang = '';
      onstart?: () => void;
      onend?: () => void;
      onerror?: (event: SpeechSynthesisErrorEvent) => void;
      constructor(public text: string) {}
    }
    globalThis.SpeechSynthesisUtterance = MockUtterance as unknown as typeof SpeechSynthesisUtterance;
    Object.defineProperty(globalThis, 'speechSynthesis', {
      value: { speak, cancel, getVoices: () => [] } as unknown as SpeechSynthesis,
      configurable: true,
    });

    const status = speakGameMasterVoice('Canal activo.');
    expect(status).toBe('speaking');
    expect(cancel).toHaveBeenCalled();
    expect(speak).toHaveBeenCalled();
    const utterance = speak.mock.calls[0][0] as InstanceType<typeof MockUtterance>;
    expect(utterance.rate).toBe(GM_VOICE_RATE);
    expect(utterance.pitch).toBe(GM_VOICE_PITCH);
    expect(utterance.volume).toBe(1);
    expect(formatGameMasterVoiceHudLabel(true)).toContain('on');
  });
});
