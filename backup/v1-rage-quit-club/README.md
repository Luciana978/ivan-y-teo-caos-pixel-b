# RAGE QUIT CLUB

Plataformas 2D de precisión con trampas sorpresa y humor. Corre directo en el navegador,
sin registro, sin backend, sin compras y sin recursos remotos.

> **Promesa del juego:** cada nivel parece fácil hasta que algo no funciona como esperabas.
> Las muertes son parte del diseño, no un castigo.

---

## 1. Resumen técnico

| Área | Decisión |
| --- | --- |
| Motor | Propio: Canvas 2D + física a paso fijo. Sin motor de juego externo. |
| Render | Resolución lógica interna **480×240** (30×15 tiles de 16 px) escalada con `image-rendering: pixelated`. |
| Física | Paso fijo de **1/120 s** con acumulador y `delta` acotado a 50 ms: la simulación no depende del FPS. |
| UI | React + Tailwind sólo para menús, HUD y resultados. El juego no depende de React para simular. |
| Audio | Síntesis con **Web Audio API** (un único `AudioContext`, creado en el primer gesto). |
| Persistencia | `localStorage` versionado y validado, con *fallback* en memoria. |
| Recursos | Cero imágenes remotas: todo el pixel art se dibuja por código. |
| Build | Vite + `vite-plugin-singlefile` → un único `dist/index.html` autocontenido. |

**Estados del juego:** `menu · playing · dying · paused · complete · gamecomplete`.
`dying` congela la simulación (evita muertes duplicadas) y `paused` detiene el mundo y las trampas.

**Colisiones:** AABB contra el mapa de tiles, resuelto por ejes (X luego Y) con plataformas de un
sentido (`-`), muros laterales y plataformas móviles con arrastre (*rider*). La velocidad máxima por
paso (~4 px) es menor que un tile, así que no hay tunelado.

**Trampas (todas reproducibles y telegrafiadas):**

| Tipo | Aviso | Comportamiento |
| --- | --- | --- |
| Pinchos ocultos `h` | temblor + sonido, 300 ms | brotan al acercarte y quedan fuera hasta el reinicio |
| Piso frágil `f` | rajado + temblor, 220 ms | se desploma y cae |
| Piso emboscado `A` | clic + grietas, 550 ms | el tramo completo se vuelve pinchos |
| Pared fantasma `w` | brillo violeta, 300 ms | se materializa y empuja (*bonk*, no mata) |
| Pistones | flash naranja ~200 ms antes | ciclo determinista: ~60 % arriba, golpe rápido y ventana de paso siempre disponible |
| Meta falsa `X` | parpadeo violeta | estalla, deja pinchos y revela la meta real en cian |

**Puntaje:** `gemas × 150 + 1500 (nivel) + máx(0, 3000 − segundos × 30) + 800 (sin muertes) − muertes × 100`.
La tabla de marcas guarda las 8 mejores puntuaciones locales.

---

## 2. Estructura del proyecto

```
index.html                 metadatos, título, punto de montaje
README.md                  este documento
src/
  main.tsx                 arranque de React
  index.css                identidad visual retro (paleta, paneles, botones, CRT)
  App.tsx                  shell: canvas, escalado, HUD, controles táctiles, teclado global
  utils/cn.ts              helper de clases
  game/
    config.ts              constantes: paleta, físicas, tiempos, trampas, puntaje
    levels.ts              10 niveles (constructor de mapas), parser y mensajes de muerte
    physics.ts             consulta de tiles + resolución AABB + helpers matemáticos
    player.ts              estado del personaje, salto (coyote/buffer), animación
    traps.ts               trampas, plataformas móviles y pistones
    particles.ts           pool fijo de partículas (sin GC por frame)
    renderer.ts            dibujo por código: fondo, tiles, trampas, meta, sprite, partículas
    audio.ts               efectos sintetizados (Web Audio API)
    input.ts               teclado + botones táctiles con limpieza de estado
    storage.ts             guardado local versionado y validado
    game.ts                bucle, máquina de estados, cámara, puntaje, récords
    share.ts               texto compartible, Web Share API y portapapeles
  ui/
    kit.tsx                primitivas retro (botones, panel, logo, ilustración del personaje)
    screens.tsx            menú, selector de niveles, récords, controles, pausa, resultados
scripts/
  check.ts                 validación de geometría de niveles (desarrollo)
  sim.ts                   pruebas headless del motor (desarrollo)
  route.ts                 playthrough automático por rutas (desarrollo)
```

---

## 3. Requisitos y ejecución local

* Node.js 18 o superior (probado con Node 20) y npm.

```bash
npm install
npm run dev        # servidor de desarrollo con recarga en caliente
npm run build      # genera dist/index.html autocontenido
npm run preview    # sirve la build de producción
```

`npm run dev` levanta un servidor local (por defecto `http://localhost:5173`). Los módulos ES
**necesitan** ese servidor: abrir `index.html` con doble clic no funciona en desarrollo.
Después de `npm run build`, `dist/index.html` es un único archivo estático y sí puede abrirse
directo o subirse a cualquier hosting estático.

Verificación de niveles (opcional, desarrollo):

```bash
npx esbuild scripts/check.ts --bundle --format=esm --platform=node --outfile=/tmp/check.mjs && node /tmp/check.mjs
npx esbuild scripts/sim.ts   --bundle --format=esm --platform=node --outfile=/tmp/sim.mjs   && node /tmp/sim.mjs
npx esbuild scripts/route.ts --bundle --format=esm --platform=node --outfile=/tmp/route.mjs && node /tmp/route.mjs
```

---

## 4. Cómo se juega

1. Entrá, elegí **JUGAR** (o un nivel en **Niveles**).
2. Llegá a la puerta que brilla en **cian**.
3. Morí, leé el mensaje, reintentá. El contador de muertes y el tiempo siguen corriendo
   dentro del intento del nivel; **R** reinicia nivel, tiempo y muertes.
4. Al completar un nivel se desbloquea el siguiente y se guardan tu tiempo, muertes y puntaje.

### Controles de escritorio

| Acción | Teclas |
| --- | --- |
| Mover | `A` / `D` o `←` / `→` |
| Saltar | `Espacio`, `W` o `↑` |
| Reiniciar nivel | `R` |
| Pausa | `Esc` o `P` |
| Sonido | `M` |

Las teclas de juego no desplazan la página (`preventDefault`).

### Controles táctiles

Botones **◀ / ▶** a la izquierda y **SALTO** a la derecha, más **RETRY** y **PAUSE**.
Responden mientras se mantienen presionados, se liberan con `pointerup`, `pointercancel`,
`pointerleave`, blur y cambio de pestaña (no quedan entradas trabadas). El área de juego
queda siempre libre de botones.

---

## 5. Datos guardados

* Clave de `localStorage`: `rage-quit-club.save.v2`.
* Contenido: nivel completado, mejor tiempo, mejores muertes, mejor puntaje, mejores gemas,
  muertes totales, niveles completados, tabla de marcas y preferencia de sonido.
* Estructura versionada (`v: 2`). Si el dato leído no coincide, se descarta y se arranca limpio.
* Si `localStorage` no está disponible (modo privado, cuota, error), el juego avisa
  “Sin almacenamiento” y sigue siendo jugable durante la sesión.

---

## 6. Modificar niveles

Hay **10 niveles**: los 8 del MVP original más **N9 «El suelo tiene hambre»** y
**N10 «No aprendiste nada»**, dos niveles de dificultad alta que encadenan todo lo aprendido.

| Nivel | Idea central | Trampas |
| --- | --- | --- |
| N9 El suelo tiene hambre | Un puente frágil largo sobre un pozo profundo, sin margen para dudar | Pinchos ocultos, emboscada, 7 tiles frágiles, 2 pistones |
| N10 No aprendiste nada | Examen final: moverse, esperar y saltar todo junto | Pinchos ocultos, emboscada, plataforma móvil, puente frágil, 3 pistones |

Los niveles se definen en `src/game/levels.ts` con un constructor de tiles (nada de ASCII
frágil):

```ts
const b = new MapBuilder(56);      // 56 columnas, 15 filas
b.groundMix(0, 55, [[7, 14, "f"]]); // suelo, con un tramo frágil
b.plat(4, 10, 8);                   // plataforma en fila 8, columnas 4..10
b.spikes(24, 26);                   // pinchos en la fila 13 (capa de caminado)
b.hidden(28, 29);                   // pinchos ocultos
b.ghost(31, 9, 13);                 // pared fantasma (columna 31, filas 9..13)
b.start(2).goal(52);                // inicio y meta
b.gems([[13, 13], [42, 13]]);       // gemas
return b.toMap();
```

Leyenda: `.` vacío · `#` sólido · `-` plataforma de un sentido · `^` pinchos · `f` frágil ·
`A` emboscado · `h` pinchos ocultos · `w` pared fantasma · `*` gema · `S` inicio · `G` meta · `X` meta falsa.

Para agregar un nivel: creá el bloque con el constructor, agregalo a `LEVELS` y (si hace falta)
declará `movers` y `pistons`. La progresión y el guardado se adaptan solos.

Parámetros de trampas en `src/game/config.ts` → `TRAP` (`crumbleWarn`, `popWarn`, `ambushWarn`,
`ghostWarn`, rangos de activación). Las fases de los pistones se calibran contra la velocidad de
carrera (`PHYS.maxSpeed`): con `period 2.0` y separación de 6 tiles, el desfase entre pistones
consecutivos es `0.32` de ciclo.

---

## 7. Ajustar físicas y paleta

Todo está en `src/game/config.ts`:

```ts
PHYS.gravity = 1500      // px/s²
PHYS.jumpVel = 380       // ≈ 3 tiles de altura
PHYS.maxSpeed = 150      // ≈ 4.7 tiles de alcance horizontal
PHYS.coyote = 0.09       // gracia al salir del borde
PHYS.buffer = 0.12       // salto guardado antes de aterrizar
```

Reglas de diseño que dependen de estas constantes: **subidas de hasta 2 tiles**, **huecos de
hasta 4 tiles** (5 con impulso justo) y **tramos de emboscada de 4 tiles como máximo**. Si
cambiás la altura del salto, revisá esos tres números.

Paleta en `src/game/config.ts` → `PAL`, más las variables CSS en `src/index.css` (`--rtc-*`).
Ambos lados usan los mismos colores: canvas y UI comparten identidad.

---

## 8. Publicación

`npm run build` produce `dist/index.html` autocontenido (JS y CSS embebidos, sin llamadas de red).
Para publicarlo, subí ese archivo a cualquier hosting estático y configurá la URL pública:

```bash
VITE_GAME_URL="https://tu-dominio/rage-quit-club/" npm run build
```

`VITE_GAME_URL` es la dirección que se agrega al texto compartible. Si no se define, se usa la
URL actual del navegador.

---

## 9. Pruebas ejecutadas

Automáticas (headless, mismo motor que el juego, sin canvas ni DOM — `scripts/sim.ts`):

| Prueba | Resultado |
| --- | --- |
| Altura de salto ≈ 3 tiles | PASS — 46.8 px (2.92 tiles) |
| Velocidad máxima alcanzable | PASS — 386 px en 2 s |
| Sin solapamiento con bloques sólidos tras 20 s de input aleatorio en los 10 niveles | PASS — 0 casos |
| Muertes y reinicios en *fuzz* | PASS — 30 reinicios |
| Pinchos ocultos se telegrafían al acercarse | PASS |
| Piso frágil se desploma tras el aviso | PASS — 220 ms |
| Pared fantasma aparece al acercarse | PASS |
| Pistones con ventana de paso | PASS — cada pistón está arriba ≥65 % del ciclo; hasta 5 de 6 arriba a la vez |
| Resistencia del bot ingenuo en los 10 niveles | PASS — sin excepciones (no es prueba de completabilidad) |

Playthrough automático por rutas previstas (`scripts/route.ts`, físicas reales):

| Nivel | Resultado |
| --- | --- |
| N1 Tutorial sospechoso | COMPLETABLE, 0 muertes, 4.9 s |
| N2 El suelo miente | COMPLETABLE, 0 muertes, 5.4 s |
| N3 Llegaste demasiado pronto | COMPLETABLE, 0 muertes, 6.6 s |
| N4 No era una plataforma | Parcial (1/9 waypoints, 42 muertes del bot) |
| N5 Reflejos cuestionables | COMPLETABLE, 0 muertes, 5.9 s |
| N6 Confianza injustificada | COMPLETABLE, 0 muertes, 5.4 s |
| **N9 El suelo tiene hambre** | **COMPLETABLE, 0 muertes, 6.3 s** |
| **N10 No aprendiste nada** | **COMPLETABLE, 0 muertes, 6.8 s** |
| N7 Todo lo aprendiste mal | Parcial (11/17 waypoints) |
| N8 La salida está ahí | Parcial (12/16 waypoints, 0 muertes) |

Los dos niveles nuevos se verificaron con el mismo playthrough por rutas: el bot llega a la meta
sin morir en ambos. Los tres niveles “parciales” se estancan en plataformas móviles y trepas de
varios tramos: el bot heurístico no planifica esperas ni saltos cortos. Su geometría está verificada por análisis
(subidas ≤ 2 tiles, huecos ≤ 4 tiles, plataformas que cubren el tramo completo del pozo) y los
mismos mecanismos ya están validados en niveles que el bot completa (trepa de N3, pistones de N5,
emboscadas de N6). **No se afirma que esos tres niveles hayan pasado una prueba automática completa.**

Verificación manual del flujo completo (carga, menú, juego, pausa, resultados, recarga) en
navegador de escritorio y móvil: pendiente de correr en un entorno con navegador; el código fue
revisado y tipado estrictamente (`tsc --noEmit` sin errores) y `npm run build` termina sin avisos.

---

## 10. Limitaciones conocidas del MVP

* Sin sonido de fondo: sólo efectos sintetizados.
* Sin cámara vertical: los niveles miden exactamente 15 filas.
* Sin ranking mundial, cuentas ni sincronización: no hay backend, así que no hay datos compartidos.
* No hay editor de niveles ni generación procedural.
* La escalada de píxeles usa pasos de 0.5×: en pantallas muy chicas el pixel art puede verse
  levemente irregular.
* N4, N7 y N8 no tienen prueba automática de completabilidad completa (ver sección 9).
* N9 y N10 son exigentes a propósito: castigan la duda y premian la repetición. No hay puntos de
  control dentro del nivel; el reinicio es instantáneo.
* El texto compartible depende de `VITE_GAME_URL`; sin esa variable usa la URL actual.

---

## 11. Plan de validación orgánica (sin inversión)

**Tres formatos de video corto (15–30 s):**

1. **“La trampa invisible”** — pantalla dividida: primer intento fallando en pinchos ocultos,
   segundo intento pasándolos. Remate con el mensaje de muerte.
2. **“El piso era una mentira”** — una sola toma del puente frágil del N2 con el contador de
   muertes visible subiendo en tiempo real.
3. **“¿Podés sin morir?”** — desafío explícito: completar el N5 con cero muertes; mostrar la
   pantalla de resultados como prueba.

**Desafíos comparables:** *sin morir en N2/N5*, *menor tiempo en N3*, *todos las gemas de un
nivel*, *coronar los 10 niveles*. Los resultados son una pantalla que se puede compartir o copiar.

**Métricas disponibles sin backend (ya en el cliente):** muertes totales, muertes por nivel,
tiempo por nivel, mejor marca local, niveles completados, partidas iniciadas (`runsStarted`).

**Métricas que requieren analítica o backend (fuera del MVP):** retorno de jugadores, retención
a 1/7 días, origen del tráfico, tasa de compartidos.

**Señales de interés sin instrumentar:** proporción entre partidas iniciadas y niveles
completados (local), cantidad de muertes antes del primer abandono, y si la gente repite el
nivel que acaba de terminar (botón “Repetir”).

**Plan de mejoras según respuesta:** si la gente abandona en N4/N7/N8/N9/N10 → bajar la exigencia de los
pistones y agregar un punto de control; si comparten mucho los tiempos → modo contrarreloj con
marcas fantasma locales; si piden más contenido → 4 niveles extra reutilizando el mismo
constructor; si nadie usa el sonido → revisar la mezcla antes de sumar música.
