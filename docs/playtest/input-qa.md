# Input QA — gamepad, touch, keyboard

Checklist manual para la rama `codex/gamepad-support-raycast` antes del PR final. Marca cada ítem **OK / FAIL / N/A** y anota build/commit.

## Entorno

- [ ] `npm test` · `npm run lint` · `npm run build` en verde
- [ ] Rama: `codex/gamepad-support-raycast`
- [ ] Navegador: Chrome / Safari (iPad si aplica)
- [ ] Pantalla completa o PWA instalada (opcional)

## Teclado / mouse

- [ ] WASD mueve sin drift al soltar
- [ ] Mouse mira con pointer lock; sin lag extra con suavizado bajo
- [ ] Q/E giran cámara
- [ ] Disparo / recarga / cambio de arma (1–3)
- [ ] **Aim assist OFF** en mouse (sin magnetismo al pasar sobre enemigos)
- [ ] Minimapa (M) abre/cierra
- [ ] ESC o P abre pausa; gameplay se detiene

## Gamepad

- [ ] Conexión muestra “control detectado” (mensaje o entrada activa en pausa)
- [ ] Stick izq mueve; stick der mira
- [ ] RT dispara; X recarga; LB/RB armas
- [ ] Start pausa / B resume (según mapeo)
- [ ] Aim assist aplica solo con stick (no al usar solo teclado)
- [ ] Deadzones izq/der ajustables en pausa/settings
- [ ] Desconectar mando: sin input fantasma; reconectar restaura control
- [ ] Vibración ON/OFF (si el mando la soporta)

## iPad / touch

- [ ] Controles táctiles visibles en landscape
- [ ] Portrait muestra aviso de rotar (sin combate accidental)
- [ ] Joystick izq + arrastre derecho miran de forma estable
- [ ] Multitouch: joystick + look sin mezclar
- [ ] Botones DISPARAR / RECARGAR / PAUSA / MAPA responden
- [ ] Aim assist solo en touch (no en mouse de escritorio)
- [ ] Cambiar de app (Safari) y volver: sin touch pegado
- [ ] Pausa limpia contactos táctiles

## Pausa / reanudar

- [ ] Pausa congelada: enemigos/jugador no avanzan
- [ ] Menú pausa: volumen, minimapa, debug, reinicio, menú principal
- [ ] Panel “Configuración de control” ajusta sens/deadzone
- [ ] **Entrada activa** y ayuda de controles coinciden con el dispositivo usado
- [ ] Reanudar: sin salto de cámara grande; touch en modo gameplay

## Focus / blur / visibilidad

- [ ] Cambiar pestaña (blur): suelta sticks/touch
- [ ] Volver (focus): sin disparos/look espontáneos
- [ ] `visibilitychange` (iPad): mismo comportamiento que blur

## Settings (menú principal)

- [ ] Ajustes persisten tras recargar (save v1)
- [ ] Aim assist: OFF / BAJO / NORMAL
- [ ] Suavizado cámara, sensibilidades, deadzones
- [ ] Entrada activa y ayuda contextual en pantalla

## Regresiones explícitas (no tocar)

- [ ] Daño / cadencia / ammo sin cambios perceptibles
- [ ] Mapas y progresión intactos
- [ ] Sin HUD de controles en gameplay (solo pausa/settings)

## Notas del tester

| Fecha | Dispositivo | Commit | Fallos |
|-------|-------------|--------|--------|
|       |             |        |        |
