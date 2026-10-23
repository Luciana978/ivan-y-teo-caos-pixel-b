/**
 * scripts/replay.ts — reproducción de entradas GRABADAS (sólo desarrollo).
 *
 *   npm run test:replay
 *
 * A diferencia de route.ts (un bot que decide solo), aquí se reproduce una secuencia fija de
 * pulsaciones [desde_s, hasta_s, teclas] sobre las físicas reales. Si el personaje llega a la
 * meta sin morir, el nivel queda demostrado como completable por una persona con esa secuencia
 * (no demuestra que sea cómodo ni divertido: eso requiere prueba humana, ver PLAYTEST.md).
 */
import { PHYS, TILE } from "../src/game/config";
import { LEVELS, parseLevel } from "../src/game/levels";
import { overlap } from "../src/game/physics";
import { createPlayer, resetPlayer, touchingSpikes, updatePlayer } from "../src/game/player";
import { createTraps, pistonDeadly, resetTraps, updateTraps } from "../src/game/traps";

type Keys = { left?: boolean; right?: boolean; jump?: boolean };
type Seg = [number, number, Keys]; // jump:true = mantener salto; el flanco ocurre en `desde`

/** Secuencias por nivel (índice 0-based). Los tiempos están medidos en segundos de simulación. */
export const REPLAYS: Record<number, Seg[]> = {
  // N4: salto a la plataforma móvil, salto a la vertical, correr sobre el puente frágil hasta la meta
  3: [
    [0, 9, { right: true }],
    [0.55, 0.9, { jump: true }],
    [1.86, 2.25, { jump: true }],
  ],
  // N8: salto largo sobre pinchos ocultos, salto a la plataforma dormida (esperar a que cruce el pozo),
  //     cruzar pistones, escalera de 2 saltos, techo B, caer frente a la puerta
  7: [
    [0, 3.12, { right: true }],
    [2.17, 2.47, { jump: true }],
    [2.78, 3.1, { jump: true }],
    [4.4, 5.3, { right: true }],
    [5.04, 5.34, { jump: true }],
    [5.6, 6.0, { right: true }],
    [5.62, 5.92, { jump: true }],
    [6.3, 7.85, { right: true }],
    [6.3, 6.62, { jump: true }],
    [8.0, 8.12, { right: true }],
  ],
};

function play(idx: number, script: Seg[], maxT = 40) {
  const lv = parseLevel(LEVELS[idx]);
  const rt = createTraps(lv);
  const p = createPlayer(lv);
  resetTraps(lv, rt);
  resetPlayer(p, lv);
  const goalNow = () => {
    const g = lv.goal;
    return !!g && overlap(p, { x: g.x + 2, y: g.y - 12, w: 12, h: 28 });
  };
  const input = { left: false, right: false, jumpHeld: false, jumpPressed: false };
  let t = 0;
  let prevJump = false;
  while (t < maxT) {
    input.left = input.right = input.jumpHeld = false;
    for (const [a, b, k] of script) {
      if (t >= a && t < b) {
        if (k.left) input.left = true;
        if (k.right) input.right = true;
        if (k.jump) input.jumpHeld = true;
      }
    }
    input.jumpPressed = input.jumpHeld && !prevJump;
    prevJump = input.jumpHeld;
    updateTraps(lv, rt, p, p.feetTile, t, PHYS.step, { sfx() {}, shake() {}, burst() {}, kill() {}, note() {} });
    updatePlayer(p, lv, rt, input, PHYS.step, { jump() {}, land() {}, step() {}, dust() {} });
    t += PHYS.step;
    if (goalNow()) return { won: true, t, why: "meta" };
    if (touchingSpikes(lv, p)) return { won: false, t, why: `pinchos en x=${(p.x / TILE).toFixed(1)}` };
    if (pistonDeadly(rt, p)) return { won: false, t, why: `pistón en x=${(p.x / TILE).toFixed(1)}` };
    if (p.y > lv.h + 24) return { won: false, t, why: `vacío en x=${(p.x / TILE).toFixed(1)}` };
  }
  return { won: false, t, why: `tiempo agotado, x=${(p.x / TILE).toFixed(1)}` };
}

let fails = 0;
for (const [k, script] of Object.entries(REPLAYS)) {
  const idx = Number(k);
  const r = play(idx, script);
  if (!r.won) fails++;
  console.log(`${r.won ? "PASS" : "FAIL"} N${idx + 1} ${LEVELS[idx].name} — replay ${r.won ? `llega a la meta en ${r.t.toFixed(1)} s` : r.why}`);
}
process.exit(fails ? 1 : 0);
