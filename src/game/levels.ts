/**
 * levels.ts — datos de niveles, constructor de mapas, parser y mensajes de muerte.
 *
 * Los mapas se escriben con un constructor de tiles (1 carácter = 1 tile de 16px,
 * 15 filas por nivel). El constructor evita errores de alineación y hace que cada
 * nivel se lea como un plano. Leyenda de caracteres:
 *
 *   .  vacío     #  bloque sólido      -  plataforma (colisión sólo desde arriba)
 *   ^  pinchos   f  piso frágil       A  piso emboscado (se vuelve pinchos)
 *   h  pinchos ocultos (brotran al acercarte)   w  pared fantasma
 *   *  gema      S  inicio            G  meta            X  meta falsa
 *
 * Plataformas móviles y pistones se declaran por datos porque necesitan parámetros.
 */

import { ROWS, TILE } from "./config";

export const T = {
  EMPTY: 0,
  SOLID: 1,
  PLAT: 2,
  SPIKE: 3,
  CRUMBLE: 4,
  AMBUSH: 5,
  HIDDEN: 6,
  GHOST: 7,
} as const;

export type MoverDef = {
  x: number; // tile
  y: number; // tile
  w: number; // ancho en tiles
  axis: "x" | "y";
  amp: number; // recorrido en tiles
  period: number; // segundos del ciclo completo
  mode: "always" | "onStep";
  phase?: number;
};

export type PistonDef = {
  x: number; // tile
  y: number; // tile donde cuelga
  len: number; // recorrido en tiles
  period: number;
  phase: number; // 0..1
};

export type HintDef = { x: number; y: number; text: string };

/* ------------------------------------------------------------------ */
/* CONSTRUCTOR DE MAPAS                                                */
/* ------------------------------------------------------------------ */

class MapBuilder {
  rows: string[][];
  constructor(public w: number) {
    this.rows = Array.from({ length: ROWS }, () => new Array<string>(w).fill("."));
  }
  set(x: number, y: number, ch: string) {
    if (x < 0 || x >= this.w || y < 0 || y >= ROWS) return this;
    this.rows[y][x] = ch;
    return this;
  }
  /** Relleno sólido (o del carácter dado) inclusive. */
  rect(x0: number, y0: number, x1: number, y1: number, ch = "#") {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.set(x, y, ch);
    return this;
  }
  ground(x0: number, x1: number, y = 14) {
    return this.rect(x0, y, x1, y, "#");
  }
  /** Tramo de suelo con un tramo de otro material adentro. */
  groundMix(x0: number, x1: number, parts: Array<[number, number, string]>, y = 14) {
    this.ground(x0, x1, y);
    for (const [a, b, ch] of parts) this.rect(a, y, b, y, ch);
    return this;
  }
  plat(x0: number, x1: number, y: number) {
    return this.rect(x0, y, x1, y, "-");
  }
  spikes(x0: number, x1: number, y = 13) {
    return this.rect(x0, y, x1, y, "^");
  }
  fragile(x0: number, x1: number, y = 14) {
    return this.rect(x0, y, x1, y, "f");
  }
  ambush(x0: number, x1: number, y = 14) {
    return this.rect(x0, y, x1, y, "A");
  }
  hidden(x0: number, x1: number = x0, y = 13) {
    return this.rect(x0, y, x1, y, "h");
  }
  /** Pared fantasma: columna de tiles que aparecen al acercarte. */
  ghost(x: number, y0: number, y1: number) {
    return this.rect(x, y0, x, y1, "w");
  }
  gem(x: number, y: number) {
    return this.set(x, y, "*");
  }
  gems(list: Array<[number, number]>) {
    for (const [x, y] of list) this.gem(x, y);
    return this;
  }
  start(x: number, y = 13) {
    return this.set(x, y, "S");
  }
  goal(x: number, y = 13) {
    return this.set(x, y, "G");
  }
  decoy(x: number, y: number) {
    return this.set(x, y, "X");
  }
  toMap() {
    return this.rows.map((r) => r.join(""));
  }
}

/* ------------------------------------------------------------------ */
/* NIVELES                                                             */
/* ------------------------------------------------------------------ */

const L1: LevelDef = {
  id: 1,
  name: "TUTORIAL SOSPECHOSO",
  idea: "Movimiento, salto y una sola sorpresa fácil de leer.",
  parTime: 18,
  map: (() => {
    const b = new MapBuilder(56);
    b.ground(0, 55);
    b.plat(0, 4, 12).gem(3, 11);
    b.plat(18, 21, 12).gem(19, 11);
    b.plat(38, 41, 12).gem(39, 11);
    b.start(6).goal(52);
    b.hidden(28, 29);
    b.gems([
      [20, 13],
      [33, 13],
    ]);
    return b.toMap();
  })(),
  hints: [
    { x: 2, y: 10, text: "A / D  o  FLECHAS" },
    { x: 14, y: 10, text: "ESPACIO = SALTAR" },
    { x: 24, y: 10, text: "EL PISO A VECES MIENTE" },
    { x: 41, y: 10, text: "LA PUERTA BRILLA EN CIAN" },
  ],
  msgs: ["Arranque limpio. Sospechosamente limpio.", "Ni un susto. Todavía."],
};

const L2: LevelDef = {
  id: 2,
  name: "EL SUELO MIENTE",
  idea: "Piso frágil: pisás, tiembla, y no podés detenerte.",
  parTime: 24,
  map: (() => {
    const b = new MapBuilder(56);
    // suelo con puentes frágiles y dos pozos de 3 tiles
    b.groundMix(0, 55, [
      [7, 14, "f"],
      [24, 32, "f"],
      [42, 50, "f"],
    ]);
    b.rect(18, 14, 20, 14, ".");
    b.rect(36, 14, 38, 14, ".");
    b.plat(4, 10, 8).gem(8, 7);
    b.plat(23, 29, 5).gem(27, 4);
    b.plat(46, 52, 11).gem(50, 10);
    b.start(2).goal(52);
    b.gems([
      [13, 13],
      [42, 13],
      [21, 12],
      [39, 12],
    ]);
    return b.toMap();
  })(),
  hints: [
    { x: 7, y: 12, text: "PISO RAJOSO: NO FRENE" },
    { x: 33, y: 12, text: "EL TEMBLOR AVISA" },
  ],
  msgs: [
    "El suelo también se cansa.",
    "Pisaste lo que no había que pisar.",
    "Gravedad 1 — Confianza 0.",
  ],
};

const L3: LevelDef = {
  id: 3,
  name: "LLEGASTE DEMASIADO PRONTO",
  idea: "Pared fantasma: el camino bajo se cierra; arriba estaba la salida.",
  parTime: 30,
  map: (() => {
    const b = new MapBuilder(56);
    b.ground(0, 55);
    // techo / camino alto
    b.rect(18, 8, 47, 8, "#");
    b.gem(24, 7).gem(30, 7).gem(40, 7);
    // escalera de subida (a la izquierda del techo)
    b.plat(6, 9, 12).gem(7, 11);
    b.plat(12, 16, 10).gem(14, 9);
    // pilar fantasma que cierra el camino bajo
    b.ghost(31, 9, 13);
    b.spikes(24, 26).spikes(33, 35);
    b.start(2).goal(52);
    b.gems([
      [27, 13],
      [37, 13],
      [50, 13],
    ]);
    return b.toMap();
  })(),
  hints: [
    { x: 3, y: 11, text: "SUBE. ABAJO NO HAY SALIDA" },
    { x: 34, y: 6, text: "HAY PAREDES QUE APARECEN" },
  ],
  msgs: [
    "La pared llegó antes que vos.",
    "Ese camino estaba cerrado desde el principio.",
    "Casi. Muy casi.",
  ],
};

const L4: LevelDef = {
  id: 4,
  name: "NO ERA UNA PLATAFORMA",
  idea: "Plataformas dormidas: se mueven recién cuando las pisás.",
  parTime: 36,
  map: (() => {
    const b = new MapBuilder(56);
    // torres
    b.rect(0, 10, 7, 14); // A
    b.rect(18, 10, 21, 14); // B
    b.rect(30, 8, 33, 14); // C (más alta)
    b.rect(44, 10, 55, 14); // D (meta)
    // pinchos al fondo de los pozos
    b.spikes(8, 17, 14).spikes(22, 29, 14).spikes(34, 43, 14);
    // puente frágil entre C y D
    b.fragile(35, 42, 9);
    b.plat(50, 54, 8);
    b.start(3, 9).goal(52, 9);
    b.gems([
      [6, 9],
      [31, 7],
      [38, 8],
      [52, 7],
      [19, 9],
    ]);
    return b.toMap();
  })(),
  movers: [
    { x: 9, y: 10, w: 4, axis: "x", amp: 6, period: 3.2, mode: "always" },
    { x: 26, y: 11, w: 4, axis: "y", amp: 4, period: 2.8, mode: "onStep" },
  ],
  hints: [
    { x: 1, y: 8, text: "SALTA A LA PLATAFORMA DORMIDA" },
    { x: 34, y: 7, text: "PISO RAJOSO: CORRE" },
  ],
  msgs: [
    "La plataforma tenía otros planes.",
    "No era una plataforma: era una decisión.",
    "Te llevó justo a donde no querías ir.",
  ],
};

const L5: LevelDef = {
  id: 5,
  name: "REFLEJOS CUESTIONABLES",
  idea: "Pistones con ritmo: el flash avisa, esperás tu ventana y cruzás.",
  parTime: 38,
  map: (() => {
    const b = new MapBuilder(56);
    b.ground(0, 55);
    b.rect(10, 5, 47, 5, "#"); // techo de los pistones
    b.hidden(23, 24).hidden(35, 36);
    b.start(2).goal(52);
    b.gems([
      [17, 11],
      [29, 11],
      [41, 11],
      [16, 13],
      [28, 13],
      [40, 13],
    ]);
    return b.toMap();
  })(),
  // Fases calibradas: a velocidad de carrera constante todos están arriba al llegar.
  pistons: [
    { x: 13, y: 6, len: 7, period: 2.0, phase: 0.04 },
    { x: 19, y: 6, len: 7, period: 2.0, phase: 0.72 },
    { x: 25, y: 6, len: 7, period: 2.0, phase: 0.4 },
    { x: 31, y: 6, len: 7, period: 2.0, phase: 0.08 },
    { x: 37, y: 6, len: 7, period: 2.0, phase: 0.76 },
    { x: 43, y: 6, len: 7, period: 2.0, phase: 0.44 },
  ],
  hints: [
    { x: 3, y: 12, text: "EL FLASH AVISA EL GOLPE" },
    { x: 20, y: 12, text: "MANTENÉ EL RITMO" },
  ],
  msgs: [
    "El pistón no negociaba.",
    "Ritmo: cero. Ánimo: mucho.",
    "Te cayó la arquitectura encima.",
  ],
};

const L6: LevelDef = {
  id: 6,
  name: "CONFIANZA INJUSTIFICADA",
  idea: "Piso emboscado: parece sólido y se vuelve pinchos. No te duermas.",
  parTime: 34,
  map: (() => {
    const b = new MapBuilder(56);
    b.groundMix(0, 55, [
      [13, 16, "A"],
      [25, 28, "A"],
      [37, 40, "A"],
    ]);
    b.hidden(46, 47);
    // ruta alta de gemas
    b.plat(13, 15, 12).gem(14, 10);
    b.plat(18, 21, 10).gem(19, 8);
    b.plat(25, 28, 8).gem(26, 6);
    b.plat(33, 36, 10).gem(34, 8);
    b.start(2).goal(52);
    b.gems([
      [14, 13],
      [26, 13],
      [38, 13],
      [44, 13],
    ]);
    return b.toMap();
  })(),
  hints: [
    { x: 4, y: 12, text: "PISO DUDOSO: MANTENÉ EL PASO" },
    { x: 30, y: 12, text: "LAS GRIETAS AVISAN" },
  ],
  msgs: [
    "La confianza era opcional.",
    "Ese piso era una trampa con buena pintura.",
    "Nuevo récord personal de malas decisiones.",
  ],
};

const L7: LevelDef = {
  id: 7,
  name: "TODO LO APRENDISTE MAL",
  idea: "Meta falsa: la puerta que parpadea no es la puerta. La real aparece atrás.",
  parTime: 50,
  map: (() => {
    const b = new MapBuilder(56);
    // suelo: sólido + puente frágil + pozo + sólido + emboscada + pedestal
    b.groundMix(0, 55, [
      [12, 19, "f"],
      [42, 45, "A"],
    ]);
    b.rect(20, 14, 28, 14, "."); // pozo (se cruza con plataforma móvil)
    b.rect(50, 13, 53, 14); // pedestal de la meta falsa
    // techo del sector de pistones
    b.rect(30, 8, 38, 8, "#");
    // plataforma alta donde aparece la meta real
    b.plat(1, 7, 8).gem(3, 7);
    b.plat(8, 10, 10); // escalón 2
    b.plat(12, 16, 12); // escalón 1 (ancho: el regreso desde la plataforma móvil queda a 3 tiles)
    b.start(2).decoy(51, 12);
    b.hidden(34, 35);
    b.gems([
      [2, 9],
      [5, 6],
      [22, 11],
      [26, 11],
      [43, 13],
      [47, 13],
    ]);
    return b.toMap();
  })(),
  movers: [{ x: 20, y: 13, w: 4, axis: "x", amp: 5, period: 2.6, mode: "always" }],
  pistons: [
    { x: 31, y: 9, len: 4, period: 1.9, phase: 0.0 },
    { x: 37, y: 9, len: 4, period: 1.9, phase: 0.5 },
  ],
  goal2: { x: 6, y: 7 },
  hints: [
    { x: 3, y: 11, text: "PISO RAJOSO, DESPUÉS VACÍO" },
    { x: 44, y: 11, text: "¿ESA PUERTA PARPADEA?" },
  ],
  msgs: [
    "Esa puerta era una imitación.",
    "La salida estaba atrás. Casi.",
    "Aprendiste todo. Mal.",
  ],
};

const L8: LevelDef = {
  id: 8,
  name: "LA SALIDA ESTÁ AHÍ",
  idea: "Final: piso frágil, emboscada, pistones, plataforma dormida y pared fantasma.",
  parTime: 70,
  map: (() => {
    const b = new MapBuilder(64);
    // suelo: sólido, frágil, sólido con emboscada, pozo, sólido con techo de pistones
    b.groundMix(0, 63, [
      [10, 17, "f"],
      [28, 36, "."],
    ]);
    b.ambush(19, 22);
    b.hidden(24); // 1 tile: deja 3 tiles de aterrizaje antes del pozo (ventana de salto ~2x más ancha)
    // techo A (pistones)
    b.rect(37, 8, 42, 8, "#");
    // techo B (camino alto + pared fantasma)
    b.rect(49, 8, 61, 8, "#");
    b.ghost(56, 9, 13);
    // escalera al camino alto
    b.plat(43, 45, 12).plat(46, 48, 10);
    b.start(2).goal(62);
    b.gems([
      [13, 13],
      [21, 13],
      [30, 11],
      [44, 11],
      [39, 7],
      [52, 6],
      [58, 7],
    ]);
    return b.toMap();
  })(),
  movers: [{ x: 29, y: 13, w: 4, axis: "x", amp: 5, period: 2.8, mode: "onStep" }],
  pistons: [
    { x: 38, y: 9, len: 4, period: 1.9, phase: 0.0 },
    { x: 40, y: 9, len: 4, period: 1.9, phase: 0.5 },
  ],
  hints: [
    { x: 2, y: 12, text: "ÚLTIMO TRAMO. SIN PIEDAD." },
    { x: 44, y: 11, text: "ARRIBA. SIEMPRE ARRIBA." },
  ],
  msgs: [
    "Estaba ahí. Literalmente ahí.",
    "Te faltó un salto y mucha humildad.",
    "La física no negocia.",
  ],
};


const L9: LevelDef = {
  id: 9,
  name: "EL SUELO TIENE HAMBRE",
  idea: "Puente frágil largo sobre un pozo, emboscada y pistones. Sin margen para dudar.",
  parTime: 42,
  map: (() => {
    const b = new MapBuilder(56);
    b.ground(0, 55);
    // pozo corto de entrada
    b.rect(10, 14, 12, 14, ".");
    // emboscada de 4 tiles
    b.ambush(17, 20);
    // puente frágil completo sobre un pozo profundo
    b.rect(26, 14, 32, 14, ".");
    b.fragile(26, 32, 14);
    // un tramo de pinchos ocultos antes del último esfuerzo
    b.hidden(36);
    // techo con dos pistones
    b.rect(45, 6, 55, 6, "#");
    b.start(2).goal(54);
    b.gems([
      [14, 13],
      [23, 13],
      [30, 12],
      [35, 13],
      [43, 13],
      [48, 13],
    ]);
    return b.toMap();
  })(),
  pistons: [
    { x: 46, y: 7, len: 6, period: 1.8, phase: 0.0 },
    { x: 50, y: 7, len: 6, period: 1.8, phase: 0.2 },
  ],
  hints: [
    { x: 2, y: 12, text: "SIN FRENAR. LAS TRAMPAS NO PERDONAN" },
    { x: 27, y: 12, text: "PUENTE FRÁGIL: CORRÉ" },
    { x: 46, y: 11, text: "DOS PISTONES. UNA VENTANA" },
  ],
  msgs: [
    "El puente te estaba esperando.",
    "Corriste bien. Hasta que dejaste de correr.",
    "El suelo se comió tu confianza.",
  ],
};

const L10: LevelDef = {
  id: 10,
  name: "NO APRENDISTE NADA",
  idea: "Examen final: pinchos ocultos, emboscada, plataforma móvil, puente frágil y tres pistones.",
  parTime: 52,
  map: (() => {
    const b = new MapBuilder(64);
    b.ground(0, 63);
    // pozo corto
    b.rect(8, 14, 10, 14, ".");
    // pinchos ocultos y emboscada
    b.hidden(14, 15);
    b.ambush(18, 21);
    // pozo largo con plataforma móvil (su extremo final apoya en el suelo)
    b.rect(25, 14, 32, 14, ".");
    // puente frágil sobre pozo
    b.rect(37, 14, 43, 14, ".");
    b.fragile(37, 43, 14);
    // pinchos ocultos finales + techo con tres pistones
    b.hidden(46, 47);
    b.rect(50, 6, 63, 6, "#");
    b.start(2).goal(62);
    b.gems([
      [12, 13],
      [16, 12],
      [23, 13],
      [28, 12],
      [35, 13],
      [40, 12],
      [45, 13],
      [48, 13],
      [53, 13],
      [57, 12],
    ]);
    return b.toMap();
  })(),
  movers: [{ x: 25, y: 13, w: 4, axis: "x", amp: 5, period: 2.6, mode: "always" }],
  pistons: [
    { x: 51, y: 7, len: 6, period: 1.8, phase: 0.0 },
    { x: 55, y: 7, len: 6, period: 1.8, phase: 0.2 },
    { x: 59, y: 7, len: 6, period: 1.8, phase: 0.4 },
  ],
  hints: [
    { x: 2, y: 12, text: "EXAMEN FINAL. TODO JUNTO." },
    { x: 26, y: 12, text: "ESPERÁ LA PLATAFORMA" },
    { x: 53, y: 11, text: "TRES PISTONES. CERO EXCUSAS." },
  ],
  msgs: [
    "No aprendiste nada. Y aun así te admiro.",
    "El caos te acepta igual.",
    "La salida estaba al final. Como siempre.",
  ],
};

export type LevelDef = {
  id: number;
  name: string;
  idea: string;
  map: string[];
  movers?: MoverDef[];
  pistons?: PistonDef[];
  hints?: HintDef[];
  goal2?: { x: number; y: number };
  parTime: number;
  msgs?: string[];
};

export const LEVELS: LevelDef[] = [L1, L2, L3, L4, L5, L6, L7, L8, L9, L10];

/* ------------------------------------------------------------------ */
/* MENSAJES DE MUERTE                                                  */
/* ------------------------------------------------------------------ */

export const DEATH_MESSAGES: string[] = [
  "La confianza era opcional.",
  "Ese salto tenía otras intenciones.",
  "La física no negocia.",
  "La salida estaba ahí. Casi.",
  "Nuevo récord personal de malas decisiones.",
  "Eso dolió en 8 bits.",
  "El piso ganó esta mano.",
  "Aprendiste algo. Ojalá.",
  "Bello intento. Horrible ejecución.",
  "La gravedad siempre cobra.",
  "Fallaste con estilo, al menos.",
  "Nadie vio eso. Mentira: todos lo vieron.",
  "El nivel te leyó como un libro.",
  "Moriste como viviste: apurado.",
  "Otra vez, pero con menos fe.",
  "Los pinchos no aceptan disculpas.",
  "El vacío también cobra alquiler.",
  "Casi una obra de arte.",
  "Repetiste el error con convicción.",
  "Eso no fue mala suerte: fue matemática.",
];

/* ------------------------------------------------------------------ */
/* PARSER                                                              */
/* ------------------------------------------------------------------ */

export type Gem = { tx: number; ty: number; x: number; y: number; taken: boolean; t: number };
export type Group = { tiles: number[]; state: number; timer: number };
export type Crumble = { idx: number; tx: number; ty: number; state: number; timer: number };

export type ParsedLevel = {
  def: LevelDef;
  cols: number;
  rows: number;
  w: number;
  h: number;
  tiles: Uint8Array;
  tiles0: Uint8Array;
  start: { x: number; y: number };
  goal: { x: number; y: number } | null;
  goal2: { x: number; y: number } | null;
  decoy: { tx: number; ty: number; state: number; timer: number } | null;
  gems: Gem[];
  crumbles: Crumble[];
  pops: Group[];
  ambushes: Group[];
  ghosts: Group[];
  movers: MoverDef[];
  pistons: PistonDef[];
};

const CHAR_TO_TILE: Record<string, number> = {
  "#": T.SOLID,
  "-": T.PLAT,
  "^": T.SPIKE,
  f: T.CRUMBLE,
  A: T.AMBUSH,
  h: T.HIDDEN,
  w: T.GHOST,
};

function tid(cols: number, tx: number, ty: number) {
  return ty * cols + tx;
}

/** Agrupa tiles contiguos del mismo código (horizontal, o vertical si vertical=true). */
function buildGroups(tiles: Uint8Array, cols: number, rows: number, code: number, vertical: boolean) {
  const seen = new Set<number>();
  const groups: Group[] = [];
  for (let ty = 0; ty < rows; ty++) {
    for (let tx = 0; tx < cols; tx++) {
      const first = tid(cols, tx, ty);
      if (tiles[first] !== code || seen.has(first)) continue;
      const list: number[] = [];
      let cx = tx;
      let cy = ty;
      for (;;) {
        const i = tid(cols, cx, cy);
        if (tiles[i] !== code || seen.has(i)) break;
        seen.add(i);
        list.push(i);
        if (vertical) cy++;
        else cx++;
      }
      groups.push({ tiles: list, state: 0, timer: 0 });
    }
  }
  return groups;
}

export function parseLevel(def: LevelDef): ParsedLevel {
  const raw = def.map.slice(0, ROWS);
  while (raw.length < ROWS) raw.push("");
  const cols = raw.reduce((m, r) => Math.max(m, r.length), 0);
  const rows = ROWS;
  const tiles = new Uint8Array(cols * rows);
  const gems: Gem[] = [];
  const crumbles: Crumble[] = [];
  let start = { x: TILE * 2, y: TILE * 12 };
  let goal: { x: number; y: number } | null = null;
  const goal2: { x: number; y: number } | null = def.goal2
    ? { x: def.goal2.x * TILE, y: def.goal2.y * TILE }
    : null;
  let decoy: ParsedLevel["decoy"] = null;

  for (let ty = 0; ty < rows; ty++) {
    const row = raw[ty];
    for (let tx = 0; tx < cols; tx++) {
      const ch = row[tx] ?? ".";
      const i = tid(cols, tx, ty);
      if (ch === "*") {
        gems.push({ tx, ty, x: tx * TILE, y: ty * TILE, taken: false, t: 0 });
      } else if (ch === "S") {
        start = { x: tx * TILE + 3, y: ty * TILE + (TILE - 14) };
      } else if (ch === "G") {
        goal = { x: tx * TILE, y: ty * TILE };
      } else if (ch === "X") {
        decoy = { tx, ty, state: 0, timer: 0 };
      } else if (CHAR_TO_TILE[ch] !== undefined) {
        tiles[i] = CHAR_TO_TILE[ch];
        if (ch === "f") crumbles.push({ idx: i, tx, ty, state: 0, timer: 0 });
      }
    }
  }

  return {
    def,
    cols,
    rows,
    w: cols * TILE,
    h: rows * TILE,
    tiles,
    tiles0: tiles.slice(),
    start,
    goal,
    goal2,
    decoy,
    gems,
    crumbles,
    pops: buildGroups(tiles, cols, rows, T.HIDDEN, false),
    ambushes: buildGroups(tiles, cols, rows, T.AMBUSH, false),
    ghosts: buildGroups(tiles, cols, rows, T.GHOST, true),
    movers: (def.movers ?? []).map((m) => ({ ...m })),
    pistons: (def.pistons ?? []).map((p) => ({ ...p })),
  };
}
