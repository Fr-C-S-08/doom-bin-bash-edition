#!/usr/bin/env node
/**
 * One-command full stack: Vite + Game Master + Ollama (Docker Compose).
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const COMPOSE_FILE = 'docker-compose.full.yml';

function runDockerInfo() {
  return new Promise((resolve) => {
    const proc = spawn('docker', ['info'], { stdio: 'ignore' });
    proc.on('error', () => resolve(false));
    proc.on('close', (code) => resolve(code === 0));
  });
}

async function main() {
  const dockerOk = await runDockerInfo();
  if (!dockerOk) {
    console.error('');
    console.error('Abre Docker Desktop y vuelve a ejecutar npm run dev:full');
    console.error('');
    process.exit(1);
  }

  console.log('[dev:full] Levantando frontend, Game Master y Ollama…');
  console.log('[dev:full]   Juego:        http://localhost:5173');
  console.log('[dev:full]   Game Master:  http://localhost:3001/health');
  console.log('[dev:full]   Ollama:       http://localhost:11434/api/tags');
  console.log('[dev:full] Ctrl+C detiene todos los contenedores.\n');

  const child = spawn('docker', ['compose', '-f', COMPOSE_FILE, 'up', '--build'], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  const shutdown = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  child.on('close', (code) => {
    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error('[dev:full] Error:', error);
  process.exit(1);
});
