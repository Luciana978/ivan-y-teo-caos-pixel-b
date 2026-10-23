/**
 * scripts/sim.ts — pruebas automáticas headless del motor (sólo desarrollo).
 *
 *   npx esbuild scripts/sim.ts --bundle --format=esm --platform=node \
 *        --outfile=/tmp/sim.mjs --log-level=error && node /tmp/sim.mjs
 *
 * No usa canvas ni DOM: ejercita exactamente los mismos módulos de física,
 * colisión, trampas y niveles que el juego.
 */
import { PHYS, TILE, TRAP } from "../src/game/config";
import { LEVELS, parseLevel, T } from "../src/game/levels";
import { overlap, tileAt, isSolidCode } from "../src/game/physics";
import { createPlayer, resetPlayer, touchingSpikes, updatePlayer, type Player } from "../src/game/player";
import { createTraps, pistonDeadly, resetTraps, updateTraps, type TrapRuntime } from "../src/game/traps";

type Res = { ok: boolean; note: string };
const results: Array<[string, Res]> = [];
function check(name: string, ok: boolean, note = "") {
  results.push([name, { ok, note }]);
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? "  -> " + note : ""}`);
}

/* ------------------------------------------------------------------ */
/* mundo mínimo equivalente al step() del juego                        */
/* ------------------------------------------------------------------ */

class World {
  lv: ReturnType<typeof parseLevel>;
  rt: TrapRuntime;
  p: Player;
  time = 0;
  dead = false;
  won = false;
  deaths = 0;
  gems = 0;
  deathReason = "";
  input = { left: false, right: false, jumpHeld: false, jumpPressed: false };

  defIdx: number;
  constructor(defIdx: number) {
    this.defIdx = defIdx;
    this.lv = parseLevel(LEVELS[defIdx]);
    this.rt = createTraps(this.lv);
    this.p = createPlayer(this.lv);
    this.reset(true);
  }

  reset(full: boolean) {
    resetTraps(this.lv, this.rt);
    resetPlayer(this.p, this.lv);
    this.dead = false;
    this.won = false;
    this.time = 0;
    if (full) {
      this.deaths = 0;
      this.gems = 0;
      for (const g of this.lv.gems) g.taken = false;
    }
  }

  goalReached() {
    const g = this.lv.goal;
    if (!g) return false;
    return overlap(this.p, { x: g.x + 3, y: g.y - 12, w: 10, h: 28 });
  }

  step(dt: number) {
    if (this.dead) return;
    this.time += dt;
    updateTraps(this.lv, this.rt, this.p, this.p.feetTile, this.time, dt, {
      sfx: () => {},
      shake: () => {},
      burst: () => {},
      kill: () => this.die("trap"),
      note: () => {},
    });
    updatePlayer(this.p, this.lv, this.rt, this.input, dt, {
      jump: () => {},
      land: () => {},
      step: () => {},
      dust: () => {},
    });
    for (const g of this.lv.gems) {
      if (!g.taken && overlap(this.p, { x: g.x + 4, y: g.y + 3, w: 8, h: 10 })) {
        g.taken = true;
        this.gems++;
      }
    }
    if (this.goalReached()) {
      this.won = true;
      return;
    }
    if (touchingSpikes(this.lv, this.p) || pistonDeadly(this.rt, this.p)) return this.die("spike");
    if (this.p.y > this.lv.h + 24) this.die("void");
  }

  die(reason: string) {
    if (this.dead) return;
    this.dead = true;
    this.deaths++;
    this.deathReason = reason;
  }
}

/* ------------------------------------------------------------------ */
/* A. invariantes de física                                            */
/* ------------------------------------------------------------------ */

function testPhysics() {
  const w = new World(0);
  // altura de salto
  let apex = 0;
  const startY = w.p.y;
  let t = 0;
  while (t < 1) {
    w.input.jumpPressed = t === 0;
    w.input.jumpHeld = true;
    w.step(PHYS.step);
    t += PHYS.step;
    apex = Math.max(apex, startY - w.p.y);
  }
  check("altura de salto ~3 tiles", apex > 44 && apex < 52, `${apex.toFixed(1)}px (${(apex / TILE).toFixed(2)} tiles)`);

  // distancia de salto horizontal a velocidad máxima
  const w2 = new World(0);
  // pista plana: nivel 1
  for (let i = 0; i < 240; i++) {
    w2.input.right = true;
    w2.input.jumpPressed = i === 100;
    w2.input.jumpHeld = i >= 100;
    w2.step(PHYS.step);
  }
  const maxX = w2.p.x;
  check("velocidad máxima alcanzada", maxX > 150 * 1.0, `x=${maxX.toFixed(0)}px en 2s`);

  // sin solaparse con sólidos tras 20s de input aleatorio determinista
  let seed = 12345;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  let insideSolid = 0;
  let deaths = 0;
  for (const def of LEVELS) {
    const wv = new World(LEVELS.indexOf(def));
    for (let i = 0; i < 20 / PHYS.step; i++) {
      wv.input.left = rnd() > 0.6;
      wv.input.right = rnd() > 0.45;
      wv.input.jumpPressed = rnd() > 0.9;
      wv.input.jumpHeld = rnd() > 0.7;
      wv.step(PHYS.step);
      if (wv.dead) {
        wv.reset(false);
        deaths++;
      }
      // cuerpo dentro de un sólido = bug de colisión
      const x0 = Math.floor(wv.p.x / TILE);
      const x1 = Math.floor((wv.p.x + wv.p.w - 1) / TILE);
      const y0 = Math.floor(wv.p.y / TILE);
      const y1 = Math.floor((wv.p.y + wv.p.h - 1) / TILE);
      for (let ty = y0; ty <= y1; ty++)
        for (let tx = x0; tx <= x1; tx++)
          if (isSolidCode(tileAt(wv.lv, tx, ty))) insideSolid++;
    }
  }
  check("sin solapamiento con bloques sólidos (20s x 8 niveles)", insideSolid === 0, `${insideSolid} casos`);
  check("muertes y reinicios funcionan (fuzz)", deaths > 0, `${deaths} reinicios en el fuzz`);

  // una muerte por evento y estado restaurado
  const w3 = new World(1); // nivel 2: piso frágil
  w3.input.right = true;
  let firstTiles: Uint8Array | null = null;
  for (let i = 0; i < 12 / PHYS.step; i++) {
    w3.input.right = true;
    w3.step(PHYS.step);
    if (w3.dead) {
      firstTiles = w3.lv.tiles.slice();
      w3.reset(false);
      break;
    }
  }
  void firstTiles;
  w3.reset(false);
  const restored = w3.lv.tiles.every((v, i) => v === w3.lv.tiles0[i]) && w3.lv.crumbles.every((c) => c.state === 0);
  check("reinicio restaura el estado de las trampas", restored, "");
}

/* ------------------------------------------------------------------ */
/* B. bot heurístico: ¿se puede completar cada nivel?                  */
/* ------------------------------------------------------------------ */

function solidAhead(w: World, dTiles: number, dy = 0) {
  const tx = Math.floor((w.p.x + w.p.w / 2) / TILE) + dTiles;
  const ty = Math.floor((w.p.y + w.p.h - 1) / TILE) + dy;
  return isSolidCode(tileAt(w.lv, tx, ty));
}
function codeAhead(w: World, dTiles: number, dy = 0) {
  const tx = Math.floor((w.p.x + w.p.w / 2) / TILE) + dTiles;
  const ty = Math.floor((w.p.y + w.p.h - 1) / TILE) + dy;
  return tileAt(w.lv, tx, ty);
}
function stepOn(w: World, dTiles: number, dy: number) {
  const tx = Math.floor((w.p.x + w.p.w / 2) / TILE) + dTiles;
  const ty = Math.floor((w.p.y + w.p.h - 1) / TILE) + dy;
  return tileAt(w.lv, tx, ty);
}

function botPolicy(w: World, mode: number) {
  const input = { left: false, right: false, jumpHeld: false, jumpPressed: false };
  const hazard = (c: number) => c === T.SPIKE || c === T.HIDDEN || c === T.AMBUSH;
  if (mode === 3) {
    input.left = true;
    input.right = false;
  } else {
    input.right = true;
  }
  if (mode === 1 || mode === 4) {
    // salto continuo
    input.jumpHeld = true;
    input.jumpPressed = true;
    return input;
  }
  const foot = stepOn(w, 1, 0);
  const below = stepOn(w, 1, 1);
  const below2 = stepOn(w, 2, 1);
  const wall = solidAhead(w, 1) || solidAhead(w, 2);
  const gapAhead = !isSolidCode(below) && !isSolidCode(below2);
  const spikeAhead = hazard(foot) || hazard(codeAhead(w, 1)) || hazard(codeAhead(w, 2));
  const platformAbove = isSolidCode(stepOn(w, 1, -2)) || isSolidCode(stepOn(w, 2, -2)) || isSolidCode(stepOn(w, 0, -2));
  const pistonLow = w.rt.pistons.some(
    (ps) => Math.abs(ps.head.x + TILE / 2 - (w.p.x + w.p.w / 2)) < 40 && ps.k > 0.25,
  );
  if (wall || gapAhead || spikeAhead || pistonLow || (w.p.onGround && platformAbove)) {
    input.jumpPressed = true;
    input.jumpHeld = true;
  }
  return input;
}

function testBot() {
  const budget = 90; // segundos de simulación por nivel
  for (let i = 0; i < LEVELS.length; i++) {
    const w = new World(i);
    const startX = w.p.x;
    let maxX = startX;
    let mode = 0;
    let modeT = 0;
    let stuckT = 0;
    let t = 0;
    let lastX = w.p.x;
    let goalX = 0;
    const g = w.lv.goal;
    if (g) goalX = g.x;
    while (t < budget) {
      // cambio de modo si no hay progreso
      if (Math.abs(w.p.x - lastX) < 3) stuckT += PHYS.step;
      else stuckT = 0;
      lastX = w.p.x;
      if (stuckT > 2.2) {
        stuckT = 0;
        mode = (mode + 1) % 5;
        modeT = 0;
      }
      modeT += PHYS.step;
      if (modeT > 5) {
        mode = 0;
        modeT = 0;
      }
      w.input = botPolicy(w, mode);
      w.step(PHYS.step);
      t += PHYS.step;
      maxX = Math.max(maxX, w.p.x);
      if (w.dead) w.reset(false);
      if (w.won) break;
    }
    const pct = goalX ? Math.round(((maxX - startX) / Math.max(1, goalX - startX)) * 100) : 0;
    // El bot ingenuo NO es una prueba de completabilidad: se usa para resistencia
    // (sin cuelgues ni excepciones). La verificación de rutas está en scripts/route.ts.
    console.log(
      `INFO  N${i + 1} ${LEVELS[i].name}: ${w.won ? "llegó" : `progreso ${Math.min(100, pct)}%`}, muertes=${w.deaths}, t=${t.toFixed(1)}s`,
    );
  }
  check("el bot ingenuo recorre los 10 niveles sin excepciones", true, "prueba de resistencia");
}

/* ------------------------------------------------------------------ */
/* C. trampas: disparan y son telegráficas                             */
/* ------------------------------------------------------------------ */

function testTraps() {
  // pinchos ocultos del nivel 1 brotan al acercarse
  const w = new World(0);
  for (let i = 0; i < 6 / PHYS.step; i++) {
    w.input.right = true;
    w.step(PHYS.step);
  }
  const anyPop = w.lv.pops.some((g) => g.state > 0);
  check("pinchos ocultos se telegrafían al acercarse", anyPop, `estado=${w.lv.pops.map((g) => g.state).join(",")}`);

  // piso frágil cae después del aviso
  const w2 = new World(1);
  let fell = false;
  for (let i = 0; i < 8 / PHYS.step; i++) {
    w2.input.right = true;
    w2.step(PHYS.step);
    if (w2.lv.crumbles.some((c) => c.state >= 2)) {
      fell = true;
      break;
    }
  }
  check("piso frágil se desploma tras el aviso", fell, `aviso=${(TRAP.crumbleWarn * 1000).toFixed(0)}ms`);

  // pared fantasma aparece y bloquea
  const w3 = new World(2);
  w3.p.x = 27 * TILE; // frente a la pared de la columna 31
  w3.p.y = 12 * TILE;
  let ghostSolid = false;
  for (let i = 0; i < 2 / PHYS.step; i++) {
    w3.step(PHYS.step);
    if (w3.lv.ghosts.some((gr) => gr.state === 2)) {
      ghostSolid = true;
      break;
    }
  }
  check("pared fantasma aparece al acercarse a la meta", ghostSolid, "");

  // pistones: siempre hay ventana de paso
  const w4 = new World(4);
  let allUp = 0;
  const seenUp = new Set<number>();
  const upTime = new Array(w4.rt.pistons.length).fill(0);
  const steps = Math.round(4 / PHYS.step);
  for (let i = 0; i < steps; i++) {
    w4.step(PHYS.step);
    const up = w4.rt.pistons.filter((p, idx) => {
      if (p.k < 0.3) {
        seenUp.add(idx);
        upTime[idx] += PHYS.step;
        return true;
      }
      return false;
    }).length;
    allUp = Math.max(allUp, up);
  }
  const minUpPct = Math.min(...upTime.map((t) => t / 4));
  check(
    "pistones tienen ventana de paso en todo el recorrido",
    seenUp.size === w4.rt.pistons.length && allUp >= 3 && minUpPct > 0.5,
    `máx arriba=${allUp}/6, mínimo arriba=${(minUpPct * 100).toFixed(0)}% del tiempo`,
  );
}

testPhysics();
testTraps();
testBot();

const fails = results.filter((r) => !r[1].ok).length;
console.log(`\n${results.length - fails}/${results.length} pruebas OK, ${fails} fallas`);
process.exit(fails ? 1 : 0);
