import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  chunkVoiceSpeakText,
  formatGameMasterVoiceHudLabel,
  getGameMasterVoiceTestPhrase,
  pickPreferredSpeechVoice,
  resetGameMasterVoiceStateForTests,
  sanitizeVoiceSpeakText,
  speakGameMasterVoice,
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

  it('prefers es-MX voices when available', () => {
    const voices = [
      { lang: 'en-US', name: 'Alex', default: false, voiceURI: 'en', localService: true } as SpeechSynthesisVoice,
      { lang: 'es-MX', name: 'Paulina', default: false, voiceURI: 'mx', localService: true } as SpeechSynthesisVoice,
    ];
    expect(pickPreferredSpeechVoice(voices)?.lang).toMatch(/es-MX/i);
  });

  it('reports unsupported when speechSynthesis is missing', () => {
    const original = globalThis.speechSynthesis;
    Object.defineProperty(globalThis, 'speechSynthesis', { value: undefined, configurable: true });
    expect(speakGameMasterVoice('hola')).toBe('unsupported');
    Object.defineProperty(globalThis, 'speechSynthesis', { value: original, configurable: true });
  });

  it('applies voice cooldown unless urgent critical', () => {
    Object.defineProperty(globalThis, 'speechSynthesis', {
      value: { speak: vi.fn(), cancel: vi.fn(), getVoices: () => [] } as unknown as SpeechSynthesis,
      configurable: true,
    });
    globalThis.SpeechSynthesisUtterance = class {
      constructor(public text: string) {}
    } as unknown as typeof SpeechSynthesisUtterance;

    speakGameMasterVoice('Primera línea.', { tier: 'ambient' });
    const second = speakGameMasterVoice('Segunda línea.', { tier: 'ambient' });
    expect(second).toBe('speaking');
    const third = speakGameMasterVoice('Tercera.', { tier: 'critical', urgent: true });
    expect(third).toBe('speaking');
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
    expect(utterance.rate).toBe(0.86);
    expect(utterance.pitch).toBe(0.82);
    expect(utterance.volume).toBe(1);
    expect(formatGameMasterVoiceHudLabel(true)).toContain('on');
  });
});
