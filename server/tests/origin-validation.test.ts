import { describe, it, expect } from 'vitest';
import { isAllowedOrigin } from '../src/index.js';

describe('isAllowedOrigin', () => {
  it('accepts undefined (Node.js test clients send no Origin)', () => {
    expect(isAllowedOrigin(undefined)).toBe(true);
  });

  it('accepts http://localhost:5173', () => {
    expect(isAllowedOrigin('http://localhost:5173')).toBe(true);
  });

  it('accepts http://127.0.0.1:5173', () => {
    expect(isAllowedOrigin('http://127.0.0.1:5173')).toBe(true);
  });

  it('accepts http://192.168.1.76:5173 (LAN 192.168.x.x)', () => {
    expect(isAllowedOrigin('http://192.168.1.76:5173')).toBe(true);
  });

  it('accepts http://10.0.0.5:5173 (LAN 10.x.x.x)', () => {
    expect(isAllowedOrigin('http://10.0.0.5:5173')).toBe(true);
  });

  it('accepts http://172.20.1.1:5173 (LAN 172.16-31.x.x)', () => {
    expect(isAllowedOrigin('http://172.20.1.1:5173')).toBe(true);
  });

  it('rejects http://evil.com', () => {
    expect(isAllowedOrigin('http://evil.com')).toBe(false);
  });

  it('rejects http://8.8.8.8:5173 (public IP)', () => {
    expect(isAllowedOrigin('http://8.8.8.8:5173')).toBe(false);
  });

  it('rejects http://172.15.0.1 (just below 172.16 range)', () => {
    expect(isAllowedOrigin('http://172.15.0.1')).toBe(false);
  });

  it('rejects http://172.32.0.1 (just above 172.31 range)', () => {
    expect(isAllowedOrigin('http://172.32.0.1')).toBe(false);
  });

  it('rejects a malformed origin string', () => {
    expect(isAllowedOrigin('not-a-url')).toBe(false);
  });
});
