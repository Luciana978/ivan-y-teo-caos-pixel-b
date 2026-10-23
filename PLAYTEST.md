# Guía de prueba — IVÁN & TEO · CAOS PIXEL

Versión privada de prueba. El objetivo no es ganar: es contarnos **si dan ganas de seguir jugando**,
dónde se traban y si alguna muerte les parece injusta. No se envía ningún dato a ningún lado: todo
queda en este navegador.

---

## 1. Abrir el juego

**Opción A — archivo suelto (la más simple).** Quien prepara la prueba hace una vez:

```bash
npm install
npm run build
```

Eso crea `dist/index.html`. Se abre con doble clic en Chrome, Edge o Firefox. Es un único archivo: se
puede copiar a otra computadora o al celular sin instalar nada.

**Opción B — servidor local.**

```bash
npm run build
npm run preview        # abrir http://localhost:4173
```

(`npm run dev` también funciona: http://localhost:5173).

**Desde el celular:** abrí `dist/index.html` copiado al teléfono, o con `npm run preview -- --host` entrá
desde el celular a la dirección de red que imprime (misma red Wi‑Fi). Girá el teléfono en horizontal.

> Cada persona/navegador tiene su propio guardado. Iván y Teo, si juegan en la misma compu y el mismo
> navegador, **comparten progreso**: usen navegadores distintos o borren el progreso entre uno y otro
> (ver §4).

---

## 2. Controles

| Acción | Teclado | Celular / táctil |
| --- | --- | --- |
| Mover | `A` `D` o `←` `→` | botones ◀ ▶ |
| Saltar (mantener = más alto) | `Espacio`, `W` o `↑` | botón SALTO |
| **Reintentar** | `R` | botón RETRY |
| Pausa / continuar | `Esc` o `P` | botón PAUSE (arriba) |
| Sonido sí/no | `M` | botón SND / MUTE (arriba) |
| Empezar o seguir en menús | `Enter`, `Espacio` o `N` | tocar el botón |

Detalle útil de `R`: **cuando aparece “MORISTE”, `R` reintenta al instante y conserva tus muertes.**
Si lo apretás mientras jugás, reinicia el nivel desde cero (tiempo y muertes del nivel vuelven a 0).

Colores: **naranja** = peligro, **violeta rajado** = piso frágil, **cian** = salida verdadera. La puerta
que **parpadea en violeta no es la salida**.

---

## 3. Qué mostrar antes de empezar (30 segundos)

Nada más que esto: *“Llegá a la puerta cian. Vas a morir bastante, es parte del juego. R reintenta.”*
No expliquen las trampas: descubrirlas es la prueba.

---

## 4. Empezar una partida nueva

* **Seguir donde quedaste:** botón **JUGAR** del menú (te lleva al siguiente nivel sin completar).
* **Elegir nivel:** **Niveles** (solo los desbloqueados; se desbloquea uno al completar el anterior).
* **Borrar todo y empezar de cero:** Menú → **Récords** → **Borrar datos** → **Confirmar borrado**
  (o, en la computadora, pie de página → **Borrar progreso** → **Sí, borrar todo**).

---

## 5. Qué observar en cada nivel

Para quien mira jugar (sin ayudar). Anotar **cuántas veces murió** y **qué dijo** en voz alta.

| Nivel | Idea | Qué observar |
| --- | --- | --- |
| **N1 Tutorial sospechoso** | Moverse, saltar, una sola sorpresa | ¿Lee las pistas del suelo? ¿Entiende el salto largo/corto? ¿Qué hace al ver los pinchos aparecer? Primera muerte: ¿entiende por qué? |
| **N2 El suelo miente** | Piso frágil | ¿Se da cuenta de que el piso tiembla y **no hay que frenar**? ¿Frena y cae? |
| **N3 Llegaste demasiado pronto** | Pared fantasma | ¿Prueba el camino de abajo? ¿Entiende que hay que subir? ¿Le parece justa la pared? |
| **N4 No era una plataforma** | Plataformas dormidas | ¿Entiende que se mueven al pisarlas? ¿Se cae al pozo de pinchos por correr de más? |
| **N5 Reflejos cuestionables** | Pistones con ritmo | ¿Espera el destello naranja o corre a ciegas? ¿Encuentra el ritmo? |
| **N6 Confianza injustificada** | Piso emboscado | El piso parece normal y se vuelve pinchos: ¿se queja? ¿Aprende a no frenar? |
| **N7 Todo lo aprendiste mal** | Meta falsa | ¿Cae en la puerta que parpadea? Tras la explosión, ¿entiende que la salida **real está atrás, arriba a la izquierda**? **Ojo:** es el único nivel sin demostración automática. Anotar si el regreso se siente posible o frustrante. |
| **N8 La salida está ahí** | Todo junto | ¿Ve que hay que **subir** por las plataformas en vez de seguir por abajo? ¿Le resulta justo el primer salto sobre los pinchos? |
| **N9 El suelo tiene hambre** | Puente frágil + pistones | ¿Corre sin frenar sobre el puente? ¿Cruza los pistones o se queda esperando? |
| **N10 No aprendiste nada** | Examen final | ¿Espera la plataforma móvil? ¿Completa o abandona? ¿En qué parte? |

También mirar en general: ¿usa `R` solo o espera el reinicio automático? ¿mira el mensaje de muerte?
¿se ríe? ¿pide “una más”? ¿en qué muerte deja de querer seguir?

---

## 6. Cómo informar un error

Copiar este formato (una entrada por problema):

```
Nivel: N__
Dispositivo / navegador: (ej. celular Android, Chrome / compu Windows, Edge)
Qué hizo el jugador: (ej. saltó desde el borde de la plataforma estando sobre el piso frágil)
Qué esperaba que pasara: (ej. llegar a la otra plataforma)
Qué pasó en realidad: (ej. cayó al vacío / se quedó pegado a la pared / no saltó)
¿Se repite? (siempre / a veces / una vez)
Captura o video (opcional)
```

Prioridad: **1)** no se puede jugar o completar, **2)** no se entiende qué pasa, **3)** muerte
injusta, **4)** detalle visual o de texto.

Casos que queremos que prueben a propósito: saltar justo en el borde de una plataforma; mantener
apretada una dirección; cambiar de dirección en el aire; morir muchas veces en la misma trampa;
apretar `R` en medio de la muerte; pausar y reanudar; cambiar de pestaña a mitad de partida; recargar
la página después de completar un nivel; jugar con el sonido apagado; (en celular) mantener apretados
los botones y soltarlos.

---

## 7. Ficha de evaluación (una por jugador, por separado)

Anotar a mano. Que responda cada uno sin escuchar al otro.

**Jugador:** ____________________  **Fecha:** ___________  **Dispositivo:** ____________________

1. ¿Te dieron ganas de seguir jugando después de morir?  ☐ Sí, mucho  ☐ Un poco  ☐ No
   ¿Por qué? _______________________________________________
2. ¿Qué nivel te gustó más? ______________________________________
3. ¿Qué nivel te pareció más difícil? ______________________________________
4. ¿Hubo alguna muerte que te pareciera injusta?  ☐ No  ☐ Sí → ¿en qué nivel y qué pasó?
   _______________________________________________________________
5. ¿Alguna vez no supiste qué hacer?  ☐ No  ☐ Sí → ¿dónde?
   _______________________________________________________________
6. ¿Qué fue lo más divertido? ____________________________________________
7. Si pudieras cambiar una sola cosa, ¿cuál sería? _________________________
8. ¿Lo volverías a jugar mañana?  ☐ Sí  ☐ Tal vez  ☐ No

**Para quien observa (opcional):**

| Dato | Anotación |
| --- | --- |
| Nivel más lejano alcanzado | |
| Muertes totales (pantalla Récords) | |
| Niveles completados | |
| ¿Dejó de jugar solo o hubo que cortarlo? | |
| Momento en que más se frustró | |
| Momento en que más se rió | |

---

## 8. Cierre de la prueba

Juntar las dos fichas y los informes de error. Antes de decidir cambios, buscar **lo que coincide** entre
Iván y Teo: si los dos se traban o se quejan en el mismo lugar, eso es un problema del juego y no de
una persona.
