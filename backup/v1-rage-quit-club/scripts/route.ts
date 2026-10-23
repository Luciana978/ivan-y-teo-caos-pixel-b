/**
 * scripts/route.ts — playthrough automático por rutas (sólo desarrollo).
 * Recorre cada nivel por su ruta prevista: si el bot llega a la meta, el nivel
 * está demostrado completable con las físicas reales del juego.
 *
 *   npx esbuild scripts/route.ts --bundle --format=esm --platform=node \
 *        --outfile=/tmp/route.mjs --log-level=error && node /tmp/route.mjs
 */
import { PHYS, TILE } from "../src/game/config";
import { LEVELS, parseLevel, T } from "../src/game/levels";
import { isSolidCode, overlap, tileAt } from "../src/game/physics";
import { createPlayer, resetPlayer, touchingSpikes, updatePlayer, type Player } from "../src/game/player";
import { createTraps, pistonDeadly, resetTraps, updateTraps, type TrapRuntime } from "../src/game/traps";

class World {
  lv: ReturnType<typeof parseLevel>;
  rt: TrapRuntime;
  p: Player;
  time = 0;
  dead = false;
  won = false;
  deaths = 0;
  deathReason = "";
  input = { left: false, right: false, jumpHeld: false, jumpPressed: false };

  constructor(public idx: number) {
    this.lv = parseLevel(LEVELS[idx]);
    this.rt = createTraps(this.lv);
    this.p = createPlayer(this.lv);
    this.hardReset();
  }
  hardReset() {
    resetTraps(this.lv, this.rt);
    resetPlayer(this.p, this.lv);
    this.time = 0;
    this.dead = false;
    this.won = false;
  }
  respawn() {
    resetTraps(this.lv, this.rt);
    resetPlayer(this.p, this.lv);
    this.dead = false;
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
      kill: () => this.die("trampa"),
      note: () => {},
    });
    updatePlayer(this.p, this.lv, this.rt, this.input, dt, {
      jump: () => {},
      land: () => {},
      step: () => {},
      dust: () => {},
    });
    if (this.goalReached()) {
      this.won = true;
      return;
    }
    if (touchingSpikes(this.lv, this.p) || pistonDeadly(this.rt, this.p)) return this.die("pinchos");
    if (this.p.y > this.lv.h + 24) this.die("vacío");
  }
  die(reason: string) {
    if (this.dead) return;
    this.dead = true;
    this.deaths++;
    this.deathReason = reason;
  }
}

type WP = { x: number; row?: number; waitMover?: number; hold?: number };

/** Rutas previstas (tile x, fila del tile sobre el que se está parado). */
const ROUTES: WP[][] = [
  /* N1 */ [{ x: 10, row: 13 }, { x: 20, row: 13 }, { x: 25, row: 13 }, { x: 33, row: 13 }, { x: 46, row: 13 }, { x: 52, row: 13 }],
  /* N2 */ [
    { x: 5, row: 13 }, { x: 11, row: 13 }, { x: 16, row: 13 }, { x: 17, row: 13 }, { x: 22, row: 13 },
    { x: 28, row: 13 }, { x: 34, row: 13 }, { x: 35, row: 13 }, { x: 41, row: 13 }, { x: 46, row: 13 }, { x: 52, row: 13 },
  ],
  /* N3 */ [
    { x: 5, row: 13 }, { x: 7, row: 11 }, { x: 9, row: 11 }, { x: 14, row: 9 }, { x: 16, row: 9 },
    { x: 21, row: 7 }, { x: 30, row: 7 }, { x: 40, row: 7 }, { x: 46, row: 7 }, { x: 50, row: 13 }, { x: 52, row: 13 },
  ],
  /* N4 */ [
    { x: 6, row: 9 }, { x: 20, row: 9 }, { x: 25, row: 10 }, { x: 30, row: 7 },
    { x: 34, row: 8 }, { x: 40, row: 8 }, { x: 43, row: 9 }, { x: 47, row: 9 }, { x: 52, row: 9 },
  ],
  /* N5 */ [
    { x: 8, row: 13 }, { x: 12, row: 13 }, { x: 17, row: 13 }, { x: 22, row: 13 }, { x: 28, row: 13 },
    { x: 33, row: 13 }, { x: 39, row: 13 }, { x: 45, row: 13 }, { x: 52, row: 13 },
  ],
  /* N6 */ [
    { x: 8, row: 13 }, { x: 14, row: 13 }, { x: 21, row: 13 }, { x: 27, row: 13 }, { x: 34, row: 13 },
    { x: 40, row: 13 }, { x: 45, row: 13 }, { x: 52, row: 13 },
  ],
  /* N7 */ [
    { x: 7, row: 13 }, { x: 10, row: 13 }, { x: 15, row: 13 }, { x: 19, row: 13 }, { x: 23, row: 12, waitMover: 0 },
    { x: 30, row: 13 }, { x: 36, row: 13 }, { x: 40, row: 13 }, { x: 44, row: 13 }, { x: 49, row: 13 },
    { x: 51, row: 12 }, { x: 44, row: 13 }, { x: 30, row: 13 }, { x: 13, row: 11 }, { x: 9, row: 9 }, { x: 5, row: 7 }, { x: 6, row: 7 },
  ],
  /* N8 */ [
    { x: 7, row: 13 }, { x: 12, row: 13 }, { x: 17, row: 13 }, { x: 19, row: 13 }, { x: 23, row: 13 },
    { x: 27, row: 13 }, { x: 40, row: 13 }, { x: 42, row: 13 }, { x: 42, row: 13 },
    { x: 44, row: 13 }, { x: 44, row: 11 }, { x: 47, row: 9 }, { x: 52, row: 7 }, { x: 58, row: 7 }, { x: 61, row: 7 }, { x: 62, row: 13 },
  ],
  /* N9 */ [
    { x: 8, row: 13 }, { x: 15, row: 13 }, { x: 16, row: 13 }, { x: 23, row: 13 }, { x: 25, row: 13 },
    { x: 34, row: 13 }, { x: 39, row: 13 }, { x: 43, row: 13 }, { x: 44, row: 13 }, { x: 54, row: 13 },
  ],
  /* N10 */ [
    { x: 6, row: 13 }, { x: 11, row: 13 }, { x: 13, row: 13 }, { x: 17, row: 13 }, { x: 23, row: 13 },
    { x: 24, row: 13, waitMover: 0 }, { x: 35, row: 13 }, { x: 36, row: 13 }, { x: 44, row: 13 },
    { x: 45, row: 13 }, { x: 49, row: 13 }, { x: 53, row: 13 }, { x: 58, row: 13 }, { x: 62, row: 13 },
  ],
];

function footRow(w: World) {
  return (w.p.y + w.p.h) / TILE - 1;
}
function codeAt(w: World, tx: number, ty: number) {
  return tileAt(w.lv, tx, ty);
}

const bot = { jumpLock: 0 };
function drive(w: World, wp: WP, dt: number) {
  const i = w.input;
  i.left = i.right = i.jumpPressed = i.jumpHeld = false;
  if (bot.jumpLock > 0) {
    bot.jumpLock -= dt;
    i.jumpHeld = true;
  }
  const pcx = w.p.x + w.p.w / 2;
  const target = wp.x * TILE + 8;
  let dx = target - pcx;
  // montado en una plataforma: acompañarla, nunca pelear contra ella
  if (w.p.rider) {
    const m = w.p.rider;
    const mv = m.def.axis === "x" ? Math.sign(m.x - m.px) : 0;
    const atHeight = wp.row === undefined || footRow(w) <= wp.row + 0.6;
    if (m.def.axis === "x") {
      if (mv > 0 || (mv === 0 && dx > 6)) i.right = true;
      else if (mv < 0 || (mv === 0 && dx < -6)) i.left = true;
      // hueco justo al terminar el recorrido de la plataforma
      if (w.p.onGround) {
        const ft = Math.floor((w.p.y + w.p.h) / TILE) - 1;
        const at = Math.floor((w.p.x + w.p.w / 2) / TILE) + Math.sign(dx || 1);
        if (
          Math.abs(dx) > 20 &&
          !isSolidCode(codeAt(w, at, ft + 1)) &&
          !isSolidCode(codeAt(w, at, ft + 2)) &&
          bot.jumpLock <= 0
        ) {
          i.jumpPressed = true;
          i.jumpHeld = true;
          bot.jumpLock = 0.4;
        }
      }
    } else if (atHeight && Math.abs(dx) > 4) {
      if (dx > 0) i.right = true;
      else i.left = true;
      if (bot.jumpLock <= 0 && w.p.onGround) {
        i.jumpPressed = true;
        i.jumpHeld = true;
        bot.jumpLock = 0.45;
      }
    }
    return;
  }
  const dir = Math.abs(dx) < 3 ? 0 : Math.sign(dx);
  const fr = Math.round(footRow(w));
  const tx = Math.floor(pcx / TILE);

  // esperar plataforma móvil cerca de su punto de embarque
  if (wp.waitMover !== undefined) {
    const m = w.rt.movers[wp.waitMover];
    if (m.x > m.def.x * TILE + 30) return;
  }

  // pistón bajado adelante: esperar
  const pistonAhead = w.rt.pistons.some(
    (p) => p.k > 0.15 && Math.abs(p.head.x + TILE / 2 - (pcx + dir * 14)) < 12,
  );
  if (pistonAhead && w.p.onGround) return;

  if (dir > 0) i.right = true;
  if (dir < 0) i.left = true;

  const needJump =
    (wp.row !== undefined && wp.row < fr && Math.abs(dx) < 132 && w.p.onGround) ||
    (() => {
      // obstáculo adelante: pared, hueco o peligro
      for (let d = 1; d <= 3; d++) {
        const c = codeAt(w, tx + dir * d, fr);
        const below = codeAt(w, tx + dir * d, fr + 1);
        const deadly = c === T.SPIKE || (d === 1 && c === T.HIDDEN);
        if (isSolidCode(c) && !isSolidCode(codeAt(w, tx + dir * d, fr - 1))) return true; // pared
        if (deadly) return true;
        if (!isSolidCode(below) && !isSolidCode(codeAt(w, tx + dir * d, fr + 2)) && d === 1) return true; // hueco al borde
      }
      return false;
    })();
  if (needJump && w.p.onGround && bot.jumpLock <= 0) {
    i.jumpPressed = true;
    i.jumpHeld = true;
    bot.jumpLock = 0.26; // mantener el salto a altura completa
  }
}

function runLevel(idx: number, route: WP[], budget = 70) {
  const w = new World(idx);
  let wp = 0;
  let t = 0;
  let lastX = w.p.x;
  let idleT = 0;
  let jumps = 0;
  let rDeaths = 0;
  bot.jumpLock = 0;
  while (t < budget && wp < route.length) {
    const wpStart = route[wp];
    drive(w, wpStart, PHYS.step);
    if (w.input.jumpPressed) jumps++;
    w.step(PHYS.step);
    t += PHYS.step;
    if (w.dead) {
      if (rDeaths < w.deaths)
        console.log(`    muerte #${w.deaths} (${w.deathReason}) x=${w.p.x.toFixed(0)} col=${(w.p.x / TILE).toFixed(1)} t=${t.toFixed(1)}`);
      rDeaths = w.deaths;
      w.respawn();
      continue;
    }
    // avance de waypoint
    const reachedX = Math.abs(w.p.x + w.p.w / 2 - (wpStart.x * TILE + 8)) < 10;
    const reachedRow = wpStart.row === undefined || Math.abs(footRow(w) - wpStart.row) < 1.2;
    if (reachedX && reachedRow) {
      wp++;
      continue;
    }
    // anti-atasco: si no progresa 4s, se considera falla
    if (Math.abs(w.p.x - lastX) < 1.5) idleT += PHYS.step;
    else idleT = 0;
    lastX = w.p.x;
    if (idleT > 6) break;
  }
  if (!w.won) {
    const cur = route[Math.min(wp, route.length - 1)];
    console.log(
      `    [diag N${idx + 1}] atasco en wp ${wp} (x=${cur.x}, row=${cur.row}) | jugador x=${(w.p.x / TILE).toFixed(1)} footRow=${footRow(w).toFixed(1)} onGround=${w.p.onGround} rider=${!!w.p.rider} vy=${w.p.vy.toFixed(0)}`,
    );
  }
  return { won: w.won, deaths: w.deaths, t, wp, total: route.length, jumps };
}

let fails = 0;
ROUTES.forEach((route, i) => {
  const r = runLevel(i, route);
  const ok = r.won;
  if (!ok) fails++;
  console.log(
    `${ok ? "PASS" : "FAIL"} N${i + 1} ${LEVELS[i].name} — ${ok ? "COMPLETABLE" : `través ${r.wp}/${r.total}`}, muertes=${r.deaths}, t=${r.t.toFixed(1)}s`,
  );
});
console.log(fails === 0 ? "\nTodos los niveles verificados como completables." : `\n${fails} niveles sin verificar.`);
process.exit(fails ? 1 : 0);
