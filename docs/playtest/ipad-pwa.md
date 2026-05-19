# iPad y PWA — prueba rápida

Guía breve para validar **touch + gamepad + instalación PWA** en `codex/gamepad-support-raycast`.

## Probar en iPad (Safari)

1. Despliega o sirve el build (`npm run build` → carpeta `dist/`) en HTTPS o red local segura.
2. Abre la URL en **Safari** en landscape.
3. Toca la pantalla una vez si aparece “TOCA PARA ACTIVAR AUDIO”.
4. Verifica joystick izquierdo, arrastre para mirar, y botones de combate.
5. **Pausa** (botón PAUSA o gamepad Start): confirma que no queda touch “pegado”.
6. Cambia a otra app y vuelve: sin movimiento/disparo fantasma.
7. Opcional: conecta un **mando compatible** (MFi / Xbox / DualSense según soporte del sistema).

## Instalar como app (PWA)

1. En Chrome (desktop/Android) o Safari (iPad), carga el juego por HTTPS.
2. Si el navegador lo permite, usa **Instalar** en el banner del juego o “Añadir a pantalla de inicio”.
3. Abre desde el icono: debe abrir en **standalone** (sin barra de URL).
4. `manifest.webmanifest` define orientación **landscape** y tema oscuro.

## Controles touch (resumen)

| Zona | Acción |
|------|--------|
| Joystick izq | Movimiento |
| Mitad derecha (arrastre) | Mirar |
| DISPARAR / RECARGAR | Combate |
| 1–3 | Armas |
| MAPA | Minimapa |
| PAUSA | Menú de pausa |

Ajustes: menú principal → Configuración, o pausa → Configuración de control.

## Controles gamepad (resumen)

| Control | Acción |
|---------|--------|
| Stick izquierdo | Mover |
| Stick derecho | Mirar |
| RT | Disparar |
| X | Recargar |
| LB / RB | Armas |
| Start | Pausa |

Deadzones y sensibilidad: pausa o settings del menú.

## Limitaciones conocidas

- Pointer lock de mouse **no** aplica en touch; aim assist **no** aplica a mouse/teclado.
- Vibración de mando depende del hardware y del flag en ajustes.
- PWA: el banner de instalación puede no aparecer en todos los navegadores; en iPad usar “Añadir a pantalla de inicio”.
- Multitouch limitado a un joystick + un dedo de mira para evitar gestos accidentales.
- Audio requiere gesto de usuario en iOS (primera pulsación).

## Checklist relacionado

Ver [input-qa.md](./input-qa.md) para la matriz completa pre-PR.
