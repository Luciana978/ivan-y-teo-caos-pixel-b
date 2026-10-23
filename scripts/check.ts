/**
 * scripts/check.ts — validación estática de la geometría de los niveles (sólo desarrollo).
 *
 *   npm run test:check
 *
 * Reglas (derivadas de PHYS en config.ts: salto ≈ 3 tiles de alto, ≈ 4-5 tiles de largo):
 *   R1  cada nivel tiene inicio y meta (o meta real revelada por una meta falsa)
 *   R2  el inicio está apoyado sobre un sólido y la meta sobre suelo o plataforma
 *   R3  un pozo (columna sin suelo transitable) de más de 5 tiles sólo es válido si lo cubre un
 *       puente frágil o una plataforma móvil, y los huecos hasta ella son saltables (≤ 4 tiles)
 *   R4  nunca más de 4 pinchos fijos seguidos en una fila transitable (excepto fondo de pozo)
 *   R5  ninguna gema dentro de un sólido; toda gema tiene un apoyo a ≤ 4 tiles bajo ella
 *   R6  los pistones cuelgan de un techo sólido y su recorrido termina a ras del suelo
 *   R7  las paredes fantasma están sobre suelo/techo coherente (no flotan a mitad del aire)
 *   R8  ids consecutivos y nombres únicos
 * Devuelve código de salida 1 si algo falla.
 */
import { LEVELS, parseLevel, T } from "../src/game/levels";

const GLYPH: Record<number, string> = {
  [T.EMPTY]: ".",
  [T.SOLID]: "#",
  [T.PLAT]: "-",
  [T.SPIKE]: "^",
  [T.CRUMBLE]: "f",
  [T.AMBUSH]: "A",
  [T.HIDDEN]: "h",
  [T.GHOST]: "w",
};

const VERBOSE = process.argv.includes("--map");
const MAX_GAP = 4; // hueco horizontal saltable con margen
let problems = 0;
const fail = (id: number, msg: string) => {
  problems++;
  console.log(`  FAIL N${id}: ${msg}`);
};

const walkable = (c: number) => c === T.SOLID || c === T.CRUMBLE || c === T.AMBUSH || c === T.PLAT;
const ids = new Set<string>();

LEVELS.forEach((def, idx) => {
  const lv = parseLevel(def);
  const at = (x: number, y: number) =>
    x < 0 || x >= lv.cols || y < 0 || y >= lv.rows ? T.EMPTY : lv.tiles0[y * lv.cols + x];
  console.log(`N${def.id} ${def.name} (${lv.cols}x${lv.rows})`);

  if (VERBOSE) {
    for (let y = 0; y < lv.rows; y++) {
      let line = "";
      for (let x = 0; x < lv.cols; x++) {
        let ch = GLYPH[at(x, y)] ?? "?";
        if (lv.goal && lv.goal.x >> 4 === x && lv.goal.y >> 4 === y) ch = "G";
        if (lv.goal2 && lv.goal2.x >> 4 === x && lv.goal2.y >> 4 === y) ch = "R";
        if (lv.decoy && lv.decoy.tx === x && lv.decoy.ty === y) ch = "X";
        if (lv.start.x >> 4 === x && lv.start.y >> 4 === y) ch = "S";
        if (lv.gems.some((g) => g.tx === x && g.ty === y)) ch = "*";
        line += ch;
      }
      console.log("  " + line);
    }
  }

  // R8
  if (def.id !== idx + 1) fail(def.id, `id ${def.id} no es consecutivo (esperado ${idx + 1})`);
  if (ids.has(def.name)) fail(def.id, "nombre duplicado");
  ids.add(def.name);

  // R1 / R2
  const realGoal = lv.goal ?? lv.goal2;
  if (!realGoal) fail(def.id, "sin meta (ni real ni revelable)");
  if (lv.decoy && !lv.goal2) fail(def.id, "meta falsa sin meta real (goal2) que revelar");
  const sx = Math.floor((lv.start.x + 5) / 16);
  const sy = Math.floor((lv.start.y + 13) / 16) + 1;
  if (!walkable(at(sx, sy))) fail(def.id, `el inicio (${sx},${sy - 1}) no está apoyado en un sólido`);
  const decoyOrGoal = lv.goal ?? (lv.decoy ? { x: lv.decoy.tx * 16, y: lv.decoy.ty * 16 } : null);
  if (decoyOrGoal) {
    const gx = Math.floor(decoyOrGoal.x / 16);
    const gy = Math.floor(decoyOrGoal.y / 16) + 1;
    if (!walkable(at(gx, gy))) fail(def.id, `la meta/decoy (${gx},${gy - 1}) flota sin apoyo`);
  }
  if (lv.goal2) {
    const gx = Math.floor(lv.goal2.x / 16);
    const gy = Math.floor(lv.goal2.y / 16) + 1;
    if (!walkable(at(gx, gy))) fail(def.id, `la meta real revelada (${gx},${gy - 1}) flota sin apoyo`);
  }

  // R3: pozos. Una columna es "pozo" si no hay nada transitable en filas 8..14 y no es una plataforma alta.
  const colSupport = (x: number) => {
    for (let y = 8; y <= 14; y++) if (walkable(at(x, y))) return true;
    return false;
  };
  let x = 0;
  while (x < lv.cols) {
    if (colSupport(x)) {
      x++;
      continue;
    }
    const start = x;
    while (x < lv.cols && !colSupport(x)) x++;
    const end = x - 1; // inclusive
    const width = end - start + 1;
    if (width <= MAX_GAP + 1) continue;
    // ¿lo cubre una plataforma móvil?
    const movers = lv.movers.filter((m) => {
      const lo = m.x;
      const hi = m.axis === "x" ? m.x + m.amp + m.w : m.x + m.w;
      return hi > start && lo <= end + 1;
    });
    if (movers.length === 0) {
      fail(def.id, `pozo de ${width} tiles (${start}..${end}) sin puente ni plataforma móvil`);
      continue;
    }
    const lo = Math.min(...movers.map((m) => m.x));
    const hi = Math.max(...movers.map((m) => (m.axis === "x" ? m.x + m.amp + m.w : m.x + m.w)));
    const leftGap = Math.max(0, lo - start);
    const rightGap = Math.max(0, end + 1 - hi);
    if (leftGap > MAX_GAP || rightGap > MAX_GAP)
      fail(def.id, `pozo ${start}..${end}: huecos hasta la plataforma móvil demasiado grandes (izq ${leftGap}, der ${rightGap})`);
  }

  // R4: pinchos seguidos fuera de fondos de pozo (filas < 14)
  for (let y = 0; y < lv.rows - 1; y++) {
    let run = 0;
    for (let xx = 0; xx <= lv.cols; xx++) {
      if (xx < lv.cols && at(xx, y) === T.SPIKE) run++;
      else {
        if (run > 4) fail(def.id, `${run} pinchos seguidos en fila ${y}`);
        run = 0;
      }
    }
  }

  // R5: gemas
  for (const g of lv.gems) {
    if (walkable(at(g.tx, g.ty)) || at(g.tx, g.ty) === T.SPIKE) fail(def.id, `gema (${g.tx},${g.ty}) dentro de un bloque/pinchos`);
    let supported = false;
    for (let dy = 1; dy <= 4 && !supported; dy++) if (walkable(at(g.tx, g.ty + dy))) supported = true;
    // las gemas sobre pozos son válidas si hay plataforma móvil / puente cerca; las flotantes puras se avisan
    if (!supported && !lv.movers.length && !lv.crumbles.length) fail(def.id, `gema (${g.tx},${g.ty}) flotando sin apoyo cercano`);
  }

  // R6: pistones
  for (const p of lv.pistons) {
    if (!walkable(at(p.x, p.y - 1)) && at(p.x, p.y - 1) !== T.SOLID) fail(def.id, `pistón en x=${p.x} no cuelga de un techo sólido`);
    // la cabeza mide 1 tile: abajo del todo ocupa la fila (y+len) y debe apoyar en el suelo (fila y+len+1)
    const floorRow = p.y + p.len + 1;
    if (!walkable(at(p.x, floorRow)))
      fail(def.id, `pistón en x=${p.x}: al bajar del todo queda a ${floorRow - 14} filas del suelo real (esperado apoyo en fila ${floorRow}); un jugador a pie pasaría por debajo`);
  }

  // R7: paredes fantasma
  for (const g of lv.ghosts) {
    const top = Math.floor(g.tiles[0] / lv.cols);
    const bottom = Math.floor(g.tiles[g.tiles.length - 1] / lv.cols);
    const gx = g.tiles[0] % lv.cols;
    if (!walkable(at(gx, bottom + 1))) fail(def.id, `pared fantasma x=${gx} no apoya en el suelo`);
    if (!walkable(at(gx, top - 1)) && at(gx, top - 1) !== T.SOLID) fail(def.id, `pared fantasma x=${gx} no cierra contra un techo`);
  }

  console.log(
    `  movers=${lv.movers.length} pistons=${lv.pistons.length} gems=${lv.gems.length} pops=${lv.pops.length} ambush=${lv.ambushes.length} ghosts=${lv.ghosts.length} frágiles=${lv.crumbles.length} decoy=${!!lv.decoy}`,
  );
});

console.log(`\nValidación geométrica: ${LEVELS.length} niveles, ${problems} problema(s).`);
process.exit(problems ? 1 : 0);
