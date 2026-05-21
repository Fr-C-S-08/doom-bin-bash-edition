# Docker Compose — demo completa (`dev:full`)

Un solo comando levanta **frontend**, **Game Master (Express)** y **Ollama** sin terminales manuales.

## Requisitos

- Docker Desktop en ejecución
- `npm ci` en la raíz del repo

## Arranque

```bash
npm run dev:full
```

Equivalente interno:

```bash
docker compose -f docker-compose.full.yml up --build
```

## Servicios

| Servicio | Puerto | Rol |
|----------|--------|-----|
| `game` | 5173 | Vite (`npm run docker:dev`) |
| `game-master` | 3001 | Express + narración |
| `ollama` | 11434 | Motor LLM local |
| `ollama-bootstrap` | — | Espera Ollama y hace `pull` de `llama3.2:3b` si falta |

Variables relevantes en `game-master`:

- `OLLAMA_BASE_URL=http://ollama:11434`
- `GAME_CLIENT_ORIGIN=http://localhost:5173`

## Primera ejecución

1. Docker descarga imágenes `node`, `ollama/ollama`.
2. `ollama-bootstrap` comprueba `/api/tags` y, si no existe el modelo, ejecuta pull (progreso en logs).
3. El juego y el backend pueden arrancar antes de que termine el pull; hasta entonces la API usa **fallback**.

## Validación

Con el stack arriba:

```bash
npm run dev:full:smoke
```

## Apagar

```bash
npm run dev:full:down
```

## Volúmenes

- `ollama_data` — modelos Ollama persistentes
- `game_node_modules` — dependencias del contenedor Vite
