# IVÁN & TEO — CAOS PIXEL

Plataformas 2D retro de precisión con trampas sorpresa y humor. **Versión privada de prueba** para
dos jugadores (Iván y Teo). Corre en el navegador, sin registro, sin backend, sin analítica, sin
publicidad y sin recursos remotos.

> Antes llamado *Rage Quit Club*. La copia de la versión anterior está en `backup/v1-rage-quit-club/`
> (fuera de `src/`, no entra en el build).

Para probarlo con personas: **leé [`PLAYTEST.md`](PLAYTEST.md)**.

---

## 1. Ejecutar

Requisitos: Node.js 18+ (probado con Node 20) y npm.

```bash
npm install
npm run dev        # desarrollo: http://localhost:5173
npm run build      # genera dist/index.html (un único archivo autocontenido)
npm run preview    # sirve la build de producción (http://localhost:4173)
```

`dist/index.html` es un solo archivo con JS y CSS embebidos (sin llamadas de red): puede abrirse con
doble clic o copiarse a otro equipo. Solo `npm run dev` necesita servidor.

### Pruebas (desarrollo)

| Comando | Qué hace | Falla (exit 1) si… |
| --- | --- | --- |
| `npm test` | Ejecuta `check`, `sim`, `storage`, `replay` y `ui` en cadena | cualquiera falla |
| `npm run test:check` | Valida la geometría de los 10 mapas (inicio, meta, pozos, pinchos, gemas, pistones, paredes) | una regla falla |
| `npm run test:sim` | Física, trampas, pistones (¿matan a quien camina por debajo?), cierre de salto, fuzz, reinicio | una prueba falla |
| `npm run test:storage` | Guardado: ida y vuelta, datos corruptos/maliciosos, otra versión, almacenamiento bloqueado | una prueba falla |
| `npm run test:replay` | Reproduce **entradas grabadas** (una persona podría hacerlas) sobre las físicas reales | no llega a la meta |
| `npm run test:ui` | Renderiza menú, pausa y resultados a HTML y comprueba textos y marca | excepción o texto ausente |
| `npm run test:route` | Bot heurístico por rutas (**informativo**, no está en `npm test`; ver §5) | el bot no llega |
| `npm run trace -- 8 '[[0,3,{"right":true}]]'` | Herramienta de autoría: imprime la trayectoria con unas entradas dadas | — |

Los scripts de `scripts/` no entran en el producto (no los importa `index.html`); los resultados
intermedios se escriben en `node_modules/.cache/ivt/`.

---

## 2. Controles (los que implementa el código)

| Acción | Teclado | Táctil |
| --- | --- | --- |
| Mover | `A` / `D` o `←` / `→` | botones ◀ ▶ |
| Saltar (mantener = más alto) | `Espacio`, `W` o `↑` | botón SALTO |
| Reintentar | `R` | botón RETRY |
| Pausa / continuar | `Esc` o `P` | botón PAUSE de la barra superior |
| Sonido | `M` | botón SND / MUTE de la barra superior |
| Empezar / continuar desde menú, pausa o resultados | `Enter`, `Espacio` o `N` | botones en pantalla |

Los botones táctiles solo se muestran en dispositivos con puntero táctil (`pointer: coarse`).

**`R` hace dos cosas, a propósito:**
* **Mientras morís** (mensaje de “MORISTE”): salta la espera y reintenta **conservando** tus muertes y
  tu tiempo del nivel.
* **Mientras jugás o en pausa**: reinicia el nivel desde cero (tiempo y muertes del nivel a 0).

---

## 3. Qué significan los números

| Dato | Significado |
| --- | --- |
| Muertes (HUD / resultados) | Muertes **del intento actual** del nivel. Reiniciar con `R` (jugando) las pone a 0. |
| Muertes totales (menú, récords) | Acumuladas de siempre, en todos los niveles. No bajan al reiniciar. |
| Tiempo | Segundos del intento actual; no corre en pausa ni durante la animación de muerte. |
| Gemas | Recogidas en el intento / totales del nivel. Se conservan al morir dentro del intento. |
| Puntos | `gemas × 150 + 1500 + máx(0, 3000 − segundos × 30) + 800 (sin muertes) − muertes × 100`. |
| Récords | Mejor tiempo, menos muertes y mejor puntaje **por nivel**, y tabla de las 8 mejores marcas. |

---

## 4. Guardado local

* Clave: **`ivan-teo-caos-pixel.save.v2`** (en `localStorage`).
* **Decisión:** el guardado de esta versión de prueba está aislado bajo una clave nueva. Los datos del
  MVP anterior (`rage-quit-club.save.v2`), si existen en el navegador, **no se leen ni se borran**:
  quedan intactos y simplemente no se usan. (Probado: ver `test:storage`.)
* Estructura versionada (`v: 2`) y validada: lo corrupto, negativo o de otro tipo se descarta.
* Si `localStorage` no está disponible (modo privado, cuota), el juego sigue y avisa “Sin
  almacenamiento: el progreso dura esta sesión”.
* Borrar datos requiere confirmación en dos pasos (Récords → *Borrar datos*, o pie de página →
  *Borrar progreso* → *Sí, borrar todo*).

---

## 5. Estado de verificación (observado, no supuesto)

Resultados de la última corrida (Node 20, sin navegador):

| Prueba | Resultado |
| --- | --- |
| `npm run build` | OK. `dist/index.html` 323 kB, sin recursos remotos, sin “Rage Quit” |
| `tsc --noEmit` | OK, sin errores |
| `test:check` (geometría, 10 niveles) | **0 problemas** |
| `test:sim` | **18/18** |
| `test:storage` | **15/15** |
| `test:replay` | **N4 y N8: llegan a la meta** (6,0 s y 8,4 s) |
| `test:ui` | **12/12** |
| `test:route` (bot) | **7/10**: pasan N1, N2, N3, N5, N6, N9, N10; **fallan N4, N7, N8** |

**Cómo leer `test:route`:** el bot es una heurística simple que no planifica esperas ni escaleras de
varios saltos. Sus fallos en N4 y N8 son **del bot**: ambos niveles se completan con una secuencia de
entradas grabada (`test:replay`). N7 no tiene aún prueba automática de completabilidad (ver más abajo).

**Estado por nivel** (“bot” = `test:route`; “replay” = `test:replay`; ninguno es prueba de diversión):

| Nivel | Geometría | Demostración automática | Notas |
| --- | --- | --- | --- |
| N1 Tutorial sospechoso | OK | bot ✔ | Pistas legibles; pinchos ocultos como única sorpresa |
| N2 El suelo miente | OK | bot ✔ | Puentes frágiles |
| N3 Llegaste demasiado pronto | OK | bot ✔ | Pared fantasma cierra el camino bajo |
| N4 No era una plataforma | OK | **replay ✔** (bot ✘) | 3 saltos cronometrados; depende de plataformas móviles |
| N5 Reflejos cuestionables | OK | bot ✔ | 6 pistones con ventana de paso ≥ 65 % |
| N6 Confianza injustificada | OK | bot ✔ | 3 pisos emboscados de 4 tiles |
| N7 Todo lo aprendiste mal | OK | **ninguna** ✘ | Meta falsa + regreso largo; ver “pendiente” |
| N8 La salida está ahí | OK | **replay ✔** (bot ✘) | Ventana del primer salto ensanchada (ver cambios) |
| N9 El suelo tiene hambre | OK | bot ✔ | Pistones corregidos (ahora sí bloquean) |
| N10 No aprendiste nada | OK | bot ✔ | Pistones corregidos (ahora sí bloquean) |

### Pendiente / no verificado

* **Nunca se ejecutó en un navegador real** (este entorno no tiene): canvas, audio, eventos táctiles,
  Web Share, portapapeles, escalado en pantallas pequeñas y rendimiento a 60 fps **no están probados**.
  `test:ui` solo comprueba el render a HTML.
* **N7 sin demostración automática.** Está revisado por geometría y por análisis (ver `PLAYTEST.md`).
* Que un nivel sea “completable por un bot/replay” no demuestra que sea divertido ni cómodo.
* La equidad de las trampas y la curva de dificultad requieren jugarlas (ver `PLAYTEST.md`).

---

## 6. Cambios de esta versión (auditoría)

**Identidad:** título, metadatos, logo, barra superior, pantallas de resultados, texto de compartir y
clave de guardado ahora dicen “Iván & Teo — Caos Pixel”. Copy del menú: “trampas con mala leche” →
“trampas con humor”. El texto de compartir **no incluye enlace** salvo que se compile con
`VITE_GAME_URL="https://…" npm run build` (nunca promociona localhost ni un dominio inventado).

**Defectos corregidos:**

1. **Salto perdido en pantallas ≥ 120 Hz.** El flanco de pulsación se calculaba por frame pero la física
   corre en pasos de 1/120 s; los frames sin paso descartaban el salto. Ahora la pulsación se retiene
   hasta que un paso de física la consume (una sola vez). Probado en `test:sim`.
2. **Pistones decorativos en N9 y N10.** Terminaban un tile por encima del suelo: quien caminaba por
   debajo no moría. Corregidos (`len 5 → 6`); `test:check` y `test:sim` lo vigilan (verificado con una
   prueba de mutación: reintroducir el error hace fallar ambas). *Esto invalida el “completable, 0
   muertes” que se había reportado antes para N9/N10; ahora el bot pasa con los pistones activos.*
3. **Pistas del nivel casi invisibles** (opacidad 16 %): ahora legibles, con sombra, y se atenúan solo
   a partir de los 12 s.
4. **`R` durante la muerte borraba el contador de muertes.** Ahora salta la espera y lo conserva.
5. **Espacio/Enter sobre un botón enfocado** podía disparar dos acciones (p. ej. pausar y reanudar).
   Ahora en menús/overlays activa solo el botón, y en juego se quita el foco para que Espacio salte.
6. **“Borrar progreso” sin confirmación** en el pie: ahora pide confirmación.
7. **Resultados saltables sin querer** al machacar Espacio al llegar a la meta: ignora la tecla 0,8 s.
8. Un salto pulsado durante la animación de muerte ya no se cuela en el siguiente intento.
9. Cola de teclas sin límite (fuga menor de memoria) y captura de puntero táctil sobre el elemento
   correcto.
10. **`test:check` era inútil** (15 falsos positivos y sin código de salida). Reescrito con reglas reales.
11. **N8:** la ventana del primer salto (sobre pinchos ocultos, con aterrizaje en una losa de 2 tiles
    antes de un pozo) era de ~110 ms; los pinchos pasaron de 2 a 1 tile → ~240 ms.
12. **N7:** el regreso a la meta real exigía saltar 5 tiles desde la plataforma móvil (límite físico);
    el escalón se ensanchó (ahora 3 tiles). *Ajuste por análisis; sin replay.*
13. Textos: “Gemás” → “Gemas”; “club” → “caos” en mensajes de victoria.

**Sin cambios a propósito:** física, aspecto visual, paleta, mecánicas, puntuación y el resto de niveles.

---

## 7. Estructura

```
index.html  README.md  PLAYTEST.md
backup/v1-rage-quit-club/     copia de la versión anterior (restauración manual)
src/
  main.tsx  index.css  App.tsx
  game/  config · levels · physics · player · traps · particles · renderer · audio · input · storage · game · share
  ui/    kit · screens
scripts/  check · sim · storage · replay · route · ui-smoke · trace      (solo desarrollo)
```

Ajustes de físicas y trampas: `src/game/config.ts` (`PHYS`, `TRAP`, `TIMING`, `SCORE`). Paleta: `PAL` y
las variables `--rtc-*` de `src/index.css`. Niveles: `src/game/levels.ts` (constructor `MapBuilder`).
Reglas de diseño (subidas ≤ 2 tiles, huecos ≤ 4 tiles, emboscadas ≤ 4 tiles, el pistón debe apoyar a
ras del suelo) se validan con `npm run test:check`.

## 8. Limitaciones

Sin música, sin cámara vertical, sin ranking compartido ni cuentas (no hay backend), sin puntos de
control dentro de un nivel (el reinicio es instantáneo). El escalado de píxeles usa pasos de 0,5×.
