# Game Master con Ollama (integración LLM local)

Este documento explica **qué hace Ollama dentro del juego** y cómo demostrarlo en clase o portfolio.

## Resumen en una frase

El juego **Phaser** detecta eventos de gameplay (jefe, llave, vida baja, muerte, etc.), envía contexto a un **microservicio Express local** (`localhost:3001`), ese servicio pide una línea corta a **Ollama en tu máquina** y el cliente muestra **subtítulos** `[GAME MASTER]`; opcionalmente el servidor lee la línea con la voz **`say`** de macOS. **No hay API de pago** y **el combate no se bloquea** si Ollama o el servidor fallan.

## Qué hace Ollama (y qué no)

| Ollama **sí** hace | Ollama **no** hace |
|--------------------|-------------------|
| Generar **una línea** de narración en español (México), estilo FPS retro / sci-fi | Controlar enemigos, daño, spawns ni física |
| Recibir un **prompt** con contexto del sector (vida, munición, objetivo, evento) | Sustituir el HUD, el director de encuentros ni el guardado |
| Responder vía HTTP local (`11434`) | Requerir internet ni claves de OpenAI/Anthropic |

Si Ollama no responde a tiempo, el backend y el cliente usan **mensajes fallback locales** (lista precargada). El jugador sigue jugando con normalidad.

## Arquitectura (tres procesos locales)

```text
┌─────────────────┐     POST /api/game-master/narrate      ┌──────────────────────┐
│  Juego (Vite)   │ ───────────────────────────────────► │  Express :3001       │
│  localhost:5173 │ ◄──────── { message, source } ──────── │  server/src/         │
│  RaycastScene   │         (respuesta inmediata)          │  gameMaster.ts       │
└─────────────────┘                                      └──────────┬───────────┘
        │                                                             │
        │ overlay [GAME MASTER]                                       │ POST /api/generate
        │ (subtítulos, no bloquea frames)                             ▼
        │                                                  ┌──────────────────────┐
        │                                                  │  Ollama :11434       │
        │                                                  │  modelo llama3.2:3b  │
        │                                                  └──────────────────────┘
        │
        │  (opcional) servidor dispara `say` en macOS si TTS activo
        ▼
   Subtítulo en pantalla + voz local
```

**Flujo resumido:**

1. Ocurre un evento en `RaycastScene` (pickup, puerta, `boss_spawn`, `low_health`, `player_death`, etc.).
2. `GameMasterNarrationBridge` arma contexto (vida, munición, zona, objetivo, enemigos vivos) y hace `fetch` al backend **en segundo plano**.
3. El backend construye el prompt y llama a Ollama (`stream: false`, timeout ~15 s).
4. La respuesta JSON vuelve al cliente; el overlay muestra el texto recortado (~1–2 líneas).
5. Si el jugador activó **voz** y el servidor tiene `GAME_MASTER_TTS=true`, macOS `say` lee la frase **después** de enviar el JSON (no bloquea la HTTP).

## Requisitos

- [Ollama](https://ollama.com/) instalado y en marcha
- Modelo: `ollama pull llama3.2:3b`
- Node.js 20+ (mismo repo)
- **Opcional (voz):** macOS + variable `GAME_MASTER_TTS=true` al arrancar el servidor

## Demo paso a paso (recomendado para el profesor)

Abre **tres terminales** (o dos si Ollama ya corre como servicio):

```bash
# 1) Motor LLM local (si no está ya activo)
ollama serve
# En otra terminal, una sola vez: ollama pull llama3.2:3b
```

```bash
# 2) Backend narrador (desde la raíz del repo)
npm run server:dev
# Con voz en macOS (opcional):
# GAME_MASTER_TTS=true npm run server:dev
```

```bash
# 3) Cliente del juego
npm run dev
```

4. En el navegador: **menú → prologue/nivel → entrar al raycast** (`http://localhost:5173`).

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
| URL | `http://localhost:11434/api/generate` |
| Modelo | `llama3.2:3b` |
| Streaming | `false` |
| Timeout servidor | 15 s |
| Timeout cliente | 8 s → fallback |

## Por qué no bloquea el gameplay

- El bridge dispara `fetch` con `void` / promesas; **no hay `await` en el loop de Phaser**.
- Throttle global (~3 s) y cooldown por evento evitan spam.
- Si hay narración en vuelo, eventos de baja prioridad se ignoran; los críticos pueden encolarse.
- Fallo de red → `pickClientFallbackMessage` en el cliente; el overlay igual muestra una línea.

## Sin API de pago

Todo corre en **localhost**: Ollama + Express + Vite. No se envían datos a servicios cloud de LLM en el flujo documentado.

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
| `server/src/gameMaster.ts` | Prompt, llamada Ollama, fallback servidor |
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
