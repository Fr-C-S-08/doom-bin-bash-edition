#!/usr/bin/env node
/**
 * Waits for Ollama, ensures llama3.2:3b is present (pull if missing).
 * Exits 0 even on pull failure so the stack keeps running (backend uses fallback).
 */

const OLLAMA_BASE_URL = (process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/$/, '');
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? 'llama3.2:3b';
const WAIT_TIMEOUT_MS = Number(process.env.OLLAMA_BOOTSTRAP_TIMEOUT_MS ?? 180_000);
const POLL_MS = 2_000;

function log(msg) {
  console.log(`[ollama-bootstrap] ${msg}`);
}

function warn(msg) {
  console.warn(`[ollama-bootstrap] ${msg}`);
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOllama() {
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  let attempt = 0;
  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(5_000) });
      if (res.ok) {
        log(`Ollama listo en ${OLLAMA_BASE_URL} (intento ${attempt})`);
        return true;
      }
    } catch {
      // retry
    }
    log(`Esperando Ollama en ${OLLAMA_BASE_URL}… (${attempt})`);
    await sleep(POLL_MS);
  }
  warn(`Timeout: Ollama no respondió en ${WAIT_TIMEOUT_MS / 1000}s. El backend usará fallback.`);
  return false;
}

function modelIsPresent(tagsJson, modelName) {
  const models = tagsJson?.models;
  if (!Array.isArray(models)) return false;
  const needle = modelName.toLowerCase();
  return models.some((entry) => {
    const name = String(entry?.name ?? '').toLowerCase();
    return name === needle || name.startsWith(`${needle}:`);
  });
}

async function listModels() {
  const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`tags HTTP ${res.status}`);
  return res.json();
}

async function pullModel(modelName) {
  log(`Descargando modelo ${modelName} (primera vez puede tardar varios minutos)…`);
  const res = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: modelName, stream: true }),
    signal: AbortSignal.timeout(60 * 60 * 1000),
  });
  if (!res.ok) {
    throw new Error(`pull HTTP ${res.status}`);
  }

  const reader = res.body?.getReader();
  if (!reader) {
    warn('Pull sin stream; asumiendo éxito si HTTP OK.');
    return;
  }

  const decoder = new TextDecoder();
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const chunk = JSON.parse(trimmed);
        if (chunk.status) {
          const pct =
            chunk.completed != null && chunk.total
              ? ` ${Math.round((Number(chunk.completed) / Number(chunk.total)) * 100)}%`
              : '';
          log(`${chunk.status}${pct}`);
        }
      } catch {
        // ignore non-json
      }
    }
  }
  log(`Modelo ${modelName} listo.`);
}

async function main() {
  log(`Base URL: ${OLLAMA_BASE_URL} | modelo: ${OLLAMA_MODEL}`);

  const ready = await waitForOllama();
  if (!ready) {
    process.exit(0);
  }

  try {
    const tags = await listModels();
    if (modelIsPresent(tags, OLLAMA_MODEL)) {
      log(`Modelo ${OLLAMA_MODEL} ya está en caché.`);
      process.exit(0);
    }
    await pullModel(OLLAMA_MODEL);
    const after = await listModels();
    if (!modelIsPresent(after, OLLAMA_MODEL)) {
      warn(`Modelo ${OLLAMA_MODEL} no aparece tras pull. El backend usará fallback.`);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    warn(`Bootstrap falló (${detail}). El backend seguirá con fallback local.`);
  }

  process.exit(0);
}

main();
