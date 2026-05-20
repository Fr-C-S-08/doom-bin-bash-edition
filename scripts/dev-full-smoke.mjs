#!/usr/bin/env node
/**
 * Smoke checks for npm run dev:full stack (hosts must already be up).
 */

const CHECKS = [
  { name: 'frontend', url: 'http://127.0.0.1:5173/', expectOk: true },
  { name: 'game-master health', url: 'http://127.0.0.1:3001/health', expectJson: { ok: true } },
  { name: 'ollama tags', url: 'http://127.0.0.1:11434/api/tags', expectJsonKey: 'models' },
];

const MAX_ATTEMPTS = 45;
const POLL_MS = 2_000;

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function probe(check) {
  const res = await fetch(check.url, { signal: AbortSignal.timeout(5_000) });
  if (check.expectOk && !res.ok) return false;
  if (check.expectJson) {
    const body = await res.json();
    for (const [key, value] of Object.entries(check.expectJson)) {
      if (body[key] !== value) return false;
    }
    return true;
  }
  if (check.expectJsonKey) {
    const body = await res.json();
    return body[check.expectJsonKey] != null;
  }
  return res.ok;
}

async function waitFor(check) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      if (await probe(check)) {
        console.log(`[dev:full:smoke] OK ${check.name} (${check.url}) — intento ${attempt}`);
        return true;
      }
    } catch {
      // retry
    }
    if (attempt < MAX_ATTEMPTS) {
      await sleep(POLL_MS);
    }
  }
  console.error(`[dev:full:smoke] FAIL ${check.name} (${check.url})`);
  return false;
}

async function main() {
  let ok = true;
  for (const check of CHECKS) {
    if (!(await waitFor(check))) ok = false;
  }
  if (!ok) {
    console.error('[dev:full:smoke] Al menos un endpoint no respondió. ¿Está corriendo npm run dev:full?');
    process.exit(1);
  }
  console.log('[dev:full:smoke] Todos los endpoints respondieron.');
}

main().catch((error) => {
  console.error('[dev:full:smoke] Error:', error);
  process.exit(1);
});
