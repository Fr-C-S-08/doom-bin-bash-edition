# Multiplayer Cooperativo — Brief Técnico

> Este documento es el contrato técnico del feature de multiplayer cooperativo.
> Cualquier decisión de implementación debe ser consistente con lo aquí descrito.
> Si surge una duda no cubierta, preguntar antes de improvisar.

## 1. Contexto del proyecto

`doom-bin-bash-edition` es un FPS retro con raycasting hecho en **Phaser 3 + TypeScript + Vite**, con dos escenas:

- **`RaycastScene`** (modo principal): FPS pseudo-3D con raycasting, single-player, dos niveles enlazados, enemigos con FSM, GameDirector, llaves/puertas/secretos.
- **`ArenaScene`** (modo legacy): vista top-down 2D, sandbox para sistemas heredados.

El objetivo de este feature es **convertir `RaycastScene` en cooperativo de hasta 3 jugadores via WebSockets en LAN**.

## 2. Decisiones de diseño (cerradas)

| Decisión | Valor |
|---|---|
| Modo de juego | Cooperativo PvE (jugadores vs IA) |
| Jugadores máximo | 3 (fallback aceptable: 2) |
| Escena objetivo | `RaycastScene` exclusivamente |
| `ArenaScene` | NO se toca |
| Red | LAN via WebSockets, servidor autoritativo |
| Librería WebSocket | `ws` (no socket.io) |
| Formato de mensajes | JSON |
| Tick rate del servidor | 20 Hz |
| Friendly fire | OFF (jugadores no se dañan entre sí) |
| Items (armas/munición) | Primero que llega se los queda |
| Llaves | Compartidas entre todos los jugadores |
| Muerte | Respawn con cooldown de **5 segundos** (parametrizable) |
| Game over | Si los 3 jugadores mueren simultáneamente |
| Validación de movimiento | NO server-side en esta fase (confianza al cliente) |
| Validación de disparos | SÍ server-side (hitscan validado en server) |
| Predicción del cliente | NO en esta fase |
| Lobby | Pantalla simple "Conectar a IP" |

## 3. Restricciones críticas

- **NO modificar `ArenaScene`** ni sus archivos asociados.
- **NO modificar la lógica de `RaycastScene`** existente sin necesidad estricta. Preferir extender, no reemplazar.
- **Mantener todos los tests existentes pasando** después de cada cambio (`npm run test`).
- **El equipo está trabajando en texturas en paralelo.** No tocar carpetas de assets.
- **Single-player debe seguir funcionando** después del cambio. El modo coop es opt-in.

## 4. Arquitectura

### 4.1 Estructura de carpetas

```
doom-bin-bash-edition/
├── src/                     # Cliente Phaser (existente)
│   ├── game/
│   │   ├── scenes/
│   │   │   ├── RaycastScene.ts          # se extiende para soportar net mode
│   │   │   └── MenuScene.ts             # añadir entrada a multiplayer
│   │   ├── net/                         # NUEVO — cliente de red
│   │   │   ├── NetClient.ts             # wrapper de WebSocket
│   │   │   ├── NetState.ts              # estado replicado del servidor
│   │   │   └── RemotePlayer.ts          # entidad de jugador remoto (billboard)
│   │   └── ...
│   └── tests/                           # tests existentes intactos
├── server/                  # NUEVO — servidor Node
│   ├── src/
│   │   ├── index.ts                     # entry point
│   │   ├── GameRoom.ts                  # sala de juego, gestiona una partida
│   │   ├── NetServer.ts                 # wrapper de WebSocketServer
│   │   ├── ServerWorld.ts               # estado autoritativo del mundo
│   │   └── tick.ts                      # loop del servidor a 20Hz
│   ├── package.json
│   ├── tsconfig.json
│   └── tests/
├── shared/                  # NUEVO — código compartido cliente/servidor
│   ├── protocol.ts                      # tipos de mensajes
│   ├── constants.ts                     # tick rate, max players, etc.
│   └── types.ts                         # PlayerState, EnemyState, etc.
└── ...
```

> **Notas de implementación (realidad del código):**
>
> - La lógica FSM de enemigos vive en `src/game/raycast/RaycastEnemySystem.ts`
>   (`updateRaycastEnemies()`), no en un archivo `EnemyFSM.ts` separado.
> - No existe `TargetSelector.ts` en el modo raycast; la selección de objetivo
>   está integrada en `RaycastCombatSystem.ts` (`findEnemyAlongAim()`).
> - El "estado" de un enemigo no es un enum explícito. Se deriva de flags:
>   `alive`, `spawnTelegraphUntil`, `attackWindupUntil`, `staggerUntil`.
>   Al serializar al snapshot, el servidor mapeará esos flags al campo
>   `EnemyState.state` del protocolo.
> - Existen **6 arquetipos** de enemigos en el código (no 4): `GRUNT`, `BRUTE`,
>   `STALKER`, `RANGED`, `SCRAMBLER`, `FLASHER`. `EnemyState.archetype` los
>   incluye todos.

### 4.2 Modelo de autoridad

**Servidor autoritativo light**:

- Servidor es la fuente de verdad para: enemigos, daño, vida de jugadores, llaves, puertas, GameDirector, items recogidos.
- Cliente es responsable de: su propio movimiento (sin validación server), inputs, renderizado.
- Si en el futuro se quiere lag compensation o predicción, se construye encima.

### 4.3 Tick del servidor

A 20 Hz (50 ms entre ticks), el servidor:

1. Procesa inputs recibidos desde el último tick.
2. Aplica movimiento de jugadores (sin validar).
3. Corre `GameDirector` (decide spawns).
4. Actualiza FSM de cada enemigo (chase, attack, etc.).
5. Procesa disparos pendientes (hitscan).
6. Aplica daño y muertes.
7. Aplica respawns vencidos.
8. Construye snapshot y lo envía a todos los clientes.

## 5. Protocolo de mensajes

Todos los mensajes son JSON con un campo `type`.

### 5.1 Cliente → Servidor

```typescript
// Saludo inicial al conectar
{ type: "hello", name: string }

// Inputs del jugador (enviar cada 50ms)
{
  type: "input",
  seq: number,                 // número de secuencia incremental
  x: number,                   // posición declarada
  y: number,
  yaw: number,                 // dirección en radianes
  keys: string[]               // ["w","a"], teclas presionadas
}

// Disparo
{
  type: "shoot",
  x: number,                   // pose desde donde dispara
  y: number,
  yaw: number,
  weapon: number               // id de arma 1|2|3
}

// Interacción (abrir puerta, recoger llave, etc.)
{
  type: "interact",
  targetId: string
}

// Cambio de arma
{ type: "switchWeapon", weapon: number }
```

### 5.2 Servidor → Cliente

```typescript
// Bienvenida después de connect
{
  type: "welcome",
  playerId: string,
  mapId: string,
  config: { tickRate: number, respawnCooldownMs: number }
}

// Snapshot del mundo (cada tick, 20Hz)
{
  type: "snapshot",
  tick: number,
  serverTime: number,
  players: PlayerState[],
  enemies: EnemyState[],
  projectiles: ProjectileState[],
  items: ItemState[],
  doors: DoorState[],
  level: LevelState              // llaves recolectadas, salida activa, etc.
}

// Eventos puntuales (no necesitan estar en cada snapshot)
{ type: "event", kind: "shot", from: string, dir: number }
{ type: "event", kind: "hit", target: string, by: string, damage: number }
{ type: "event", kind: "death", who: string }
{ type: "event", kind: "respawn", who: string, at: [number, number] }
{ type: "event", kind: "doorOpen", id: string }
{ type: "event", kind: "keyPickup", color: string, by: string }
{ type: "event", kind: "itemPickup", itemId: string, by: string }
{ type: "event", kind: "gameOver" }
{ type: "event", kind: "levelClear" }

// Errores
{ type: "error", reason: string }
```

### 5.3 Tipos compartidos (`shared/types.ts`)

```typescript
export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  yaw: number;
  hp: number;
  maxHp: number;
  weapon: number;
  alive: boolean;
  respawnAtTick?: number;
}

export interface EnemyState {
  id: string;
  archetype: "GRUNT" | "BRUTE" | "STALKER" | "RANGED";
  x: number;
  y: number;
  yaw: number;
  hp: number;
  state: "SPAWN" | "CHASE" | "ATTACK" | "DEAD";
}

export interface ProjectileState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  ownerId: string;
}

export interface ItemState {
  id: string;
  kind: string;
  x: number;
  y: number;
  taken: boolean;
}

export interface DoorState {
  id: string;
  open: boolean;
  requiresKey?: string;
}

export interface LevelState {
  keysCollected: string[];
  exitActive: boolean;
  secretsFound: number;
}
```

## 6. Plan por fases

### Fase 1 — Spike de conexión (Día 1)
Servidor mínimo + cliente que se conecta + mensajes de hello/welcome. Sin gameplay.

### Fase 2 — Sincronización de jugadores (Día 2)
Jugadores remotos visibles como billboards en RaycastScene. Movimiento client-authoritative.

### Fase 3 — Enemigos en el servidor (Día 3)
Mover `GameDirector`, `EnemyFSM`, `RaycastEnemy` al servidor. Clientes solo renderizan.

### Fase 4 — Combate en red (Día 4)
Disparos validados server-side. Daño, muerte, respawn con cooldown.

### Fase 5 — Lobby y nivel compartido (Día 5)
Pantalla de conexión. Llaves, puertas, items sincronizados. Game over. Pruebas LAN.

## 7. Criterios de éxito

- 3 clientes en laptops distintas en la misma LAN pueden jugar el mismo nivel.
- Ven a los mismos enemigos en las mismas posiciones.
- Pueden matar enemigos colaborativamente.
- Las llaves recolectadas por uno habilitan puertas para los otros.
- Si los 3 mueren, game over con opción a reiniciar.
- Single-player original sigue funcionando.
- `npm run test`, `npm run lint`, `npm run build` siguen pasando en cliente.
- El servidor tiene sus propios tests para lógica crítica.

## 10. TODOs para fases futuras

- **Fase 3:** Refactorizar `GameDirectorInput` de campos `p1Health`/`p2Health`/
  `p1Alive`/`p2Alive` a `players: PlayerSlot[]` para soportar 3 jugadores.
  Actualizar los tests de `game-director.test.ts`. Es prerequisito para correr
  el director en el servidor.

## 8. Fuera de alcance

Lo siguiente NO se implementa en este feature, queda para futuro:

- Validación de movimiento server-side.
- Predicción del cliente / reconciliación.
- Interpolación entre snapshots.
- Lag compensation para disparos.
- Despliegue en la nube (solo LAN).
- Persistencia de partidas.
- Reconnect después de desconexión.
- Audio espacial sincronizado.
- Más de 3 jugadores.
- Anti-cheat real.

## 9. Cómo correr el proyecto (post-feature)

```bash
# Terminal 1 — servidor
cd server
npm ci
npm run dev

# Terminal 2..N — cliente(s)
cd ..
npm run dev
# abrir http://localhost:5173, ir a Multiplayer, conectar a IP del server
```
