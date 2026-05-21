# Game Master con Ollama (integración LLM local)

Este documento explica **qué hace Ollama dentro del juego** y cómo demostrarlo en clase o portfolio.

## Demo profesional (recomendado)

**Un comando** — requiere **Docker Desktop**:

```bash
npm ci
npm run dev:full
```

Abre [http://localhost:5173](http://localhost:5173).

| Qué pasa | Detalle |
|----------|---------|
| **Primera vez** | Docker descarga imágenes; `ollama-bootstrap` puede tardar varios minutos bajando **`llama3.2:3b`**. |
| **Después** | El modelo queda en el volumen `ollama_data`; no necesitas volver a descargarlo. |
| **Sin Docker** | `npm run dev:full` muestra: *«Abre Docker Desktop y vuelve a ejecutar…»* |
| **Ollama caído** | El backend responde `source: fallback`; el raycast **sigue** sin bloquear frames. |
| **API keys** | **No** se usan OpenAI ni claves en el repo. |

Comandos:

```bash
npm run dev:full:logs    # logs de todos los servicios
npm run dev:full:smoke   # smoke: 5173, 3001/health, 11434/api/tags
npm run dev:full:down    # bajar stack
```

Arquitectura Compose: [docs/runtime/docker-full.md](../runtime/docker-full.md).

## Resumen en una frase

El juego **Phaser** detecta eventos de gameplay (jefe, llave, vida baja, muerte, etc.), envía contexto a un **microservicio Express local** (`localhost:3001`), ese servicio pide una línea corta a **Ollama** (contenedor o host en `11434`) y el cliente muestra **subtítulos** `RADIO // GM`; opcionalmente el servidor lee la línea con **`say`** en macOS o voz del navegador en el cliente. **No hay API de pago** y **el combate no se bloquea** si Ollama o el servidor fallan.

## Qué hace Ollama (y qué no)

| Ollama **sí** hace | Ollama **no** hace |
|--------------------|-------------------|
| Generar **una línea** de narración en español (México), estilo FPS retro / sci-fi | Controlar enemigos, daño, spawns ni física |
| Recibir un **prompt** con contexto del sector (vida, munición, objetivo, evento) | Sustituir el HUD, el director de encuentros ni el guardado |
| Responder vía HTTP local (`11434`) | Requerir internet ni claves de OpenAI/Anthropic |

Si Ollama no responde a tiempo, el backend y el cliente usan **mensajes fallback locales** (lista precargada). El jugador sigue jugando con normalidad.

## Arquitectura (`npm run dev:full`)

```text
┌─────────────────┐     POST /api/game-master/narrate      ┌──────────────────────┐
│  game (Vite)    │ ───────────────────────────────────► │  game-master         │
│  :5173          │ ◄──────── { message, source } ──────── │  Express :3001       │
└─────────────────┘                                      └──────────┬───────────┘
                                                                    │ OLLAMA_BASE_URL
                                                                    ▼
                                                         ┌──────────────────────┐
                                                         │  ollama :11434       │
                                                         │  llama3.2:3b         │
                                                         └──────────────────────┘
        ▲
        │  ollama-bootstrap: pull si falta el modelo
```

En Docker, el backend usa `OLLAMA_BASE_URL=http://ollama:11434`. En desarrollo manual sin Compose, el default es `http://localhost:11434`.

**Flujo resumido:**

1. Ocurre un evento en `RaycastScene` (pickup, puerta, `boss_spawn`, `low_health`, `player_death`, etc.).
2. `GameMasterNarrationBridge` arma contexto (vida, munición, zona, objetivo, enemigos vivos) y hace `fetch` al backend **en segundo plano**.
3. El backend construye el prompt y llama a Ollama (`stream: false`, timeout ~15 s).
4. La respuesta JSON vuelve al cliente; el overlay muestra el texto recortado (~1–2 líneas).
5. Si el jugador activó **voz** y el servidor tiene `GAME_MASTER_TTS=true`, macOS `say` lee la frase **después** de enviar el JSON (no bloquea la HTTP).

## Requisitos

### Con Docker (`dev:full`)

- Docker Desktop
- Node.js 20+ para `npm ci` / scripts locales

### Manual (sin Compose)

- [Ollama](https://ollama.com/) instalado y en marcha
- Modelo: `ollama pull llama3.2:3b`
- Node.js 20+
- **Opcional (voz servidor):** macOS + `GAME_MASTER_TTS=true` en `npm run server:dev`

## Demo manual (tres terminales)

Si no usas Docker:

```bash
# 1) Motor LLM
ollama serve
# otra terminal: ollama pull llama3.2:3b
```

```bash
# 2) Backend
npm run server:dev
# GAME_MASTER_TTS=true npm run server:dev   # voz macOS opcional
```

```bash
# 3) Cliente
npm run dev
```

4. Navegador: **menú → prólogo/nivel → raycast** en `http://localhost:5173`.

5. Provocar narración:
   - **G** — prueba manual del Game Master (con narración activada en ajustes).
   - O jugar hasta un evento real: recoger **llave**, abrir **puerta**, **vida baja**, **aparición de jefe**, llegar a la **salida**, etc.

6. Observar:
   - **Subtítulo** abajo a la izquierda: `[GAME MASTER] …`
   - **Voz** solo si: pausa → *Configuración de control* → `GAME MASTER · voz SÍ` **y** servidor con `GAME_MASTER_TTS=true`.
   - **F3** / Tab / `` ` `` — HUD debug con `GM idle|pending|off | voice on|off`.
   - **P** — HUD de rendimiento (incluye estado GM y última fuente `ollama` / `fallback`).

Si apagas Ollama o el servidor, el juego **sigue**; verás fallback en overlay y `source: fallback` en el HUD perf (P) cuando hubo intento de narración.

## Endpoint HTTP

### `GET /health`

```json
{ "ok": true }
```

### `POST /api/game-master/narrate`

**Body (JSON):**

```json
{
  "context": "Nivel X, vida 35%, munición baja, objetivo: abrir salida…",
  "event": "pickup_key",
  "tts": true
}
```

| Campo | Descripción |
|-------|-------------|
| `context` | Telemetría + tono; lo arma el cliente desde el snapshot de partida |
| `event` | Id del evento (`boss_spawn`, `low_health`, `door_opened`, …) |
| `tts` | Solo si el jugador activó **voz** en ajustes; el servidor habla solo si además `GAME_MASTER_TTS=true` |

**Respuesta (siempre rápida respecto al gameplay del cliente; Ollama puede tardar pero el fetch es async en el juego):**

```json
{
  "message": "Una línea de narración…",
  "source": "ollama"
}
```

| `source` | Significado |
|----------|-------------|
| `"ollama"` | El modelo respondió en local |
| `"fallback"` | Timeout, error de red, Ollama apagado o respuesta vacía |

## Eventos que dispara el juego

El cliente no consulta Ollama cada frame. Usa **cooldowns por tipo de evento** y cola de prioridad (jefe / vida crítica por encima de pickups).

| Evento | Cuándo |
|--------|--------|
| `boss_spawn` | Intro del jefe |
| `low_health` | Aviso de vida baja (misma lógica que warning HUD) |
| `player_death` | Muerte del operador |
| `objective_complete` | Salida / objetivo cumplido |
| `pickup_key` / `pickup_health` | Recogibles |
| `door_opened` | Puerta desbloqueada |
| `secret_found` | Secreto |
| `legendary_pickup` | Recompensa de núcleo de jefe |
| `wave_clear` | Oleada contenida |
| `manual_debug` | Tecla **G** |

Con **narración OFF** (ajustes) no se envían peticiones ni se muestra overlay GM.

## Ajustes en el juego (persistidos)

Pausa → **Configuración de control**:

| Ajuste | Default | Efecto |
|--------|---------|--------|
| `GAME MASTER · narración` | **SÍ** | ON = requests + overlay; OFF = silencio total GM |
| `GAME MASTER · voz` | **NO** | ON = envía `"tts": true`; OFF = solo texto |

Se guardan en `localStorage` vía `SaveManager` (`gameMasterNarration`, `gameMasterVoice`).

## Voz local macOS (`say`)

| Capa | Requisito |
|------|-----------|
| Cliente | `GAME MASTER · voz SÍ` |
| Servidor | `GAME_MASTER_TTS=true npm run server:dev` |
| SO | macOS (`darwin`); en Linux/CI la voz se omite sin error |

- Sin dependencias npm extra (`child_process` + `say`).
- Texto sanitizado, máx. **180** caracteres.
- No bloquea la respuesta HTTP; corta la frase anterior si llega otra.

## Integración técnica con Ollama

| Parámetro | Valor |
|-----------|--------|
| Base URL | `OLLAMA_BASE_URL` (default `http://localhost:11434`; Docker: `http://ollama:11434`) |
| Generate | `{OLLAMA_BASE_URL}/api/generate` |
| Modelo | `OLLAMA_MODEL` o default `llama3.2:3b` |
| Bootstrap | `scripts/ollama-bootstrap.mjs` en servicio Compose |
| Streaming | `false` |
| Timeout servidor | 15 s |
| Timeout cliente | 8 s → fallback |

## Por qué no bloquea el gameplay

- El bridge dispara `fetch` con `void` / promesas; **no hay `await` en el loop de Phaser**.
- Throttle global (~3 s) y cooldown por evento evitan spam.
- Si hay narración en vuelo, eventos de baja prioridad se ignoran; los críticos pueden encolarse.
- Fallo de red → `pickClientFallbackMessage` en el cliente; el overlay igual muestra una línea.

## Sin API de pago

Ollama + Express + Vite corren en tu máquina (host o contenedores). No se envían datos a servicios cloud de LLM en el flujo documentado. **No subas `.env` con secretos** — este proyecto no los necesita.

## Prueba rápida con curl

```bash
curl -s http://localhost:3001/health

curl -s -X POST http://localhost:3001/api/game-master/narrate \
  -H 'Content-Type: application/json' \
  -d '{"context":"búnker oscuro, vida 40%","event":"boss_spawn"}'
```

Con voz:

```bash
GAME_MASTER_TTS=true npm run server:dev

curl -s -X POST http://localhost:3001/api/game-master/narrate \
  -H 'Content-Type: application/json' \
  -d '{"context":"sector prueba","event":"manual_debug","tts":true}'
```

## Archivos principales

| Ruta | Rol |
|------|-----|
| `server/src/index.ts` | Express, CORS `:5173`, ruta narrate |
| `docker-compose.full.yml` | Stack `dev:full` |
| `scripts/dev-full.mjs` | Wrapper `npm run dev:full` |
| `scripts/ollama-bootstrap.mjs` | Pull automático del modelo |
| `server/src/gameMaster.ts` | Prompt, `OLLAMA_BASE_URL`, fallback servidor |
| `server/src/gameMasterTts.ts` | TTS opcional `say` |
| `src/services/gameMasterClient.ts` | Cliente HTTP + fallback cliente |
| `src/services/gameMasterNarrationBridge.ts` | Throttle, cola, async |
| `src/services/gameMasterNarrationContext.ts` | Contexto por evento |
| `src/game/scenes/RaycastScene.ts` | Hooks de gameplay + overlay |
| `src/game/raycast/RaycastNarrationOverlay.ts` | Subtítulos `[GAME MASTER]` |
| `src/game/sessionSettings.ts` | Toggles narración / voz |

## Alcance académico / límites

- Microservicio **opcional** para la demo; el juego compila y corre sin él.
- **No** es el backend de puntuación ni multijugador.
- OpenAPI del “juego estático” sigue siendo N/A; este endpoint es documentación manual en este archivo.

## Texto de 30 segundos (presentación oral)

> «Integramos un **Game Master** local: cuando pasan cosas importantes en el raycast —un jefe, una llave, vida crítica— el cliente manda el contexto a un **Express en el puerto 3001**, que llama a **Ollama en nuestra máquina** y devuelve una línea de radio en español. El jugador la ve como **subtítulo** y, si queremos, macOS la **lee en voz alta** con `say`. No usamos APIs de pago; si el LLM falla, hay **fallback** y el FPS **sigue corriendo** sin bloquear frames.»
