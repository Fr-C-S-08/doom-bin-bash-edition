# PR notes — gamepad + touch + combat polish

Rama: **`codex/gamepad-support-raycast`**  
Estado: listo para revisión interna; **no mergear** sin QA manual en dispositivos reales.

## Resumen de la rama

Extiende el modo raycast FPS con soporte **gamepad**, **touch (iPad)**, **save/PWA**, estabilidad de input (pausa/foco/blur), **aim assist** (solo gamepad/touch), **camera feel**, y **combat/weapon feel** profesional — sin reequilibrar daño, armas, bosses, mapas ni progresión.

## Features incluidas

| Área | Entregable |
|------|------------|
| Input | Gamepad (sticks, deadzones, vibración), touch overlay, estabilidad pausa/foco |
| Persistencia | Save v1 (settings + progreso), migración legacy |
| PWA | Manifest, service worker, banner de instalación |
| Aim / cámara | Assist OFF/BAJO/NORMAL, smoothing, deadzones, anti-spike |
| Combat feel | Recoil por arma, hit/death feedback, audio layers |
| Docs / QA | `docs/playtest/input-qa.md`, `ipad-pwa.md`, este archivo |

## Matriz de testing

| Capa | Automatizado | Manual |
|------|--------------|--------|
| Unit / integración | `npm test` (400+ tests, input/look/combat feel) | — |
| Lint / build | `npm run lint`, `npm run build` | — |
| Gamepad | tests de deadzone/frame | input-qa § Gamepad |
| Touch | tests touch input | input-qa § iPad, ipad-pwa.md |
| PWA | — | Instalar + standalone en iPad/Safari |
| Aim assist | `raycast-look-feel.test.ts` | Confirmar mouse sin assist |
| Regresión balance | — | Sin cambios de daño/ammo esperados |

## Riesgos conocidos

- **Safari iOS**: audio y fullscreen dependen de gestos del usuario; blur/visibility pueden variar por versión.
- **Gamepad**: mapeo estándar; mandos exóticos pueden necesitar remapeo futuro (fuera de alcance).
- **Touch**: palm rejection heurística; edge cases en multitouch agresivo.
- **PWA**: instalación no garantizada en todos los navegadores.
- **Combat feel**: freeze frame corto en kills — solo visual/temporal, no altera DPS.

## Qué NO se cambió

- Balance de armas (daño, cadencia, ammo, spread de diseño)
- Bosses, mapas, spawns, progresión de campaña
- Modo arena 2D / lógica de director de encuentros (salvo fixes de input)
- Economía de score / recompensas de boss

## Commits de referencia (orden reciente)

Consultar `git log codex/gamepad-support-raycast` — incluye entre otros:

- `feat(combat): add professional weapon feel and combat polish`
- `feat(save,pwa): versioned localStorage save and installable PWA shell`
- `fix(input): stabilize touch/gamepad before PR (pause, menu, focus)`
- `feat(input): add touch controls for raycast fps`

## Antes de abrir el PR

1. Completar [input-qa.md](../playtest/input-qa.md) en al menos un desktop + un iPad.
2. Verificar commit en remoto: `origin/codex/gamepad-support-raycast`.
3. Adjuntar matriz OK/FAIL y capturas de pausa/settings (entrada activa).
