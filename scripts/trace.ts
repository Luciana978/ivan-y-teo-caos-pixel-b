/**
 * scripts/trace.ts — herramienta de autoría (no es un test).
 *   npm run trace -- <nivel 1-10> '<json de segmentos>' [segundos]
 * Segmentos: [[desde, hasta, {"right":true,"left":true,"jump":true}], ...]. Imprime la posición cada 0,25 s.
 */
import { PHYS, TILE } from "../src/game/config";
import { LEVELS, parseLevel } from "../src/game/levels";
import { overlap } from "../src/game/physics";
import { createPlayer, resetPlayer, touchingSpikes, updatePlayer } from "../src/game/player";
import { createTraps, pistonDeadly, resetTraps, updateTraps } from "../src/game/traps";

const idx = Number(process.argv[2] ?? 1) - 1;
const script: Array<[number, number, { left?: boolean; right?: boolean; jump?: boolean }]> = JSON.parse(process.argv[3] ?? "[]");
const maxT = Number(process.argv[4] ?? 15);
const lv = parseLevel(LEVELS[idx]);
const rt = createTraps(lv);
const p = createPlayer(lv);
resetTraps(lv, rt);
resetPlayer(p, lv);
const inp = { left: false, right: false, jumpHeld: false, jumpPressed: false };
let t = 0, prev = false, last = -1;
while (t < maxT) {
  inp.left = inp.right = inp.jumpHeld = false;
  for (const [a, b, k] of script) if (t >= a && t < b) { inp.left ||= !!k.left; inp.right ||= !!k.right; inp.jumpHeld ||= !!k.jump; }
  inp.jumpPressed = inp.jumpHeld && !prev; prev = inp.jumpHeld;
  updateTraps(lv, rt, p, p.feetTile, t, PHYS.step, { sfx() {}, shake() {}, burst() {}, kill() {}, note() {} });
  updatePlayer(p, lv, rt, inp, PHYS.step, { jump() {}, land() {}, step() {}, dust() {} });
  t += PHYS.step;
  const k = Math.floor(t * 4);
  if (k !== last) {
    last = k;
    console.log(`t=${t.toFixed(2)} x=${(p.x / TILE).toFixed(1)} pies=${((p.y + p.h) / TILE).toFixed(1)} suelo=${p.onGround ? "S" : "-"} mover=${rt.movers.map((m) => (m.x / TILE).toFixed(1) + "," + (m.y / TILE).toFixed(1) + (m.active ? "*" : "")).join("|")} pist=${rt.pistons.map((q) => q.k.toFixed(1)).join(",")}`);
  }
  const g = lv.goal;
  if (g && overlap(p, { x: g.x + 2, y: g.y - 12, w: 12, h: 28 })) { console.log("META en t=" + t.toFixed(2)); break; }
  if (touchingSpikes(lv, p)) {
    const near: string[] = [];
    for (let ty = 0; ty < lv.rows; ty++) for (let tx = 0; tx < lv.cols; tx++) if (lv.tiles[ty * lv.cols + tx] === 3 && Math.abs(tx - p.x / TILE) < 3) near.push(`(${tx},${ty})`);
    console.log(`MUERE pinchos x=${(p.x / TILE).toFixed(1)} pies=${((p.y + p.h) / TILE).toFixed(2)} t=${t.toFixed(2)} pinchos cerca: ${near.join(" ")}`);
    break;
  }
  if (pistonDeadly(rt, p)) { console.log(`MUERE pistón x=${(p.x / TILE).toFixed(1)} t=${t.toFixed(2)}`); break; }
  if (p.y > lv.h + 24) { console.log(`MUERE vacío x=${(p.x / TILE).toFixed(1)} t=${t.toFixed(2)}`); break; }
}
