# Ollama Game Master — narración diegética

Servidor Express local + cliente Phaser que muestra líneas de **radio militar / terminal retro** generadas por Ollama (o fallback) durante el raycast FPS.

## Requisitos

- [Ollama](https://ollama.com/) en marcha: `http://localhost:11434`
- Modelo: `ollama pull llama3.2:3b`
- Node.js 20+ (toolchain del repo)

## Arranque rápido (demo portfolio)

```bash
# Terminal 1 — backend narración
npm run server:dev

# Terminal 2 — cliente
npm run dev
```

1. Abre `http://localhost:5173`
2. Entra a un **nivel boss** o juega hasta vida baja / muerte / secreto
3. Observa el panel **▌ RADIO // GAME MASTER** (abajo-izquierda) con glitch, static y cursor tipo terminal

### Probar sin Ollama

El cliente usa **fallback local** si el servidor no responde. Sigue viéndose el overlay; `source` será `fallback`.

```bash
curl -s http://localhost:3001/health
curl -s -X POST http://localhost:3001/api/game-master/narrate \
  -H 'Content-Type: application/json' \
  -d '{"context":"Nivel demo, vida 40%, escopeta","event":"boss_spawn"}'
```

### Atajos en partida

| Acción | Tecla |
|--------|--------|
| Mock narración (dev) | **N** (sin nivel completado) |
| Ajustes GM | **ESC** → Control → filas *NARRACIÓN IA* |

## Configuración en juego

En **pausa → Control**:

| Ajuste | Descripción |
|--------|-------------|
| **NARRACIÓN IA** | Activar / desactivar overlay y peticiones al Game Master |
| **NARRACIÓN · duración** | Tiempo en pantalla (2.5s – 9s, pasos 0.4s) |
| **NARRACIÓN · debug** | Muestra etiqueta `GM·DBG` y logs `[game-master]` en consola |

Valores en Phaser registry (`sessionSettings.ts`):

- `session_gm_narration_enabled` (default: `true`)
- `session_gm_narration_duration_ms` (default: `5200`)
- `session_gm_narration_debug` (default: `false`, dev auto-debug opcional)

## Arquitectura (resumen)

```text
RaycastScene (hooks gameplay)
    → buildRaycastGameMasterSnapshot()   # telemetría: vida, arma, oleada, peligro…
    → GameMasterNarrationBridge          # throttle, dedupe, async
        → gameMasterClient (fetch)       # POST /api/game-master/narrate
            → server/gameMaster.ts       # prompt Ollama + fallback
    → RaycastNarrationOverlay            # cola, fade, FX radio (sin bloquear update)
```

**Eventos narrativos:** `boss_spawn`, `low_health`, `wave_clear`, `player_death`, `legendary_pickup`.

**Desacoplamiento:** la escena no conoce Ollama; el bridge no conoce Phaser; el overlay no hace HTTP.

## Endpoints

### `GET /health`

```json
{ "ok": true }
```

### `POST /api/game-master/narrate`

**Body:** `{ "context": "…", "event": "boss_spawn" }`  
**Respuesta:** `{ "message": "…", "source": "ollama" | "fallback" }`

- CORS: `http://localhost:5173`
- Puerto: **3001**
- Timeout servidor Ollama: 15 s · cliente: 8 s

## Polish visual / UX (portfolio)

- Panel **inferior izquierdo** (no tapa objetivo central ni toasts de pickup)
- Paleta terminal sci-fi, scanline, barras de **static**, **glitch** al abrir transmisión
- Cursor `▌` parpadeante en fase hold
- Audio procedural opcional: `gmRadioBeep` + `gmTransmission` (Web Audio, bajo volumen)
- Cola con **gap** entre mensajes para lectura cómoda

## Archivos clave

| Ruta | Rol |
|------|-----|
| `server/src/index.ts` | Express + CORS |
| `server/src/gameMaster.ts` | Prompt + Ollama |
| `src/services/gameMasterClient.ts` | Cliente HTTP |
| `src/services/gameMasterNarrationBridge.ts` | Eventos + throttle |
| `src/services/gameMasterNarrationContext.ts` | Contexto dinámico |
| `src/game/raycast/RaycastGameMasterSnapshot.ts` | Snapshot desde escena |
| `src/game/raycast/RaycastNarrationOverlay.ts` | UI diegética |
| `src/game/raycast/RaycastNarrationFx.ts` | Glitch / flicker / static |
| `src/game/sessionSettings.ts` | Preferencias GM |

## Límites

- No sustituye HUD, director ni combate.
- Sin persistencia de partida en el microservicio.
- La latencia de Ollama no congela el juego (peticiones async).
