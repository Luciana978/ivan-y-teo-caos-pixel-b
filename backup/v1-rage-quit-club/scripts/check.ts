/**
 * scripts/check.ts — verificación de niveles (sólo desarrollo, no se publica).
 * Uso: npx esbuild scripts/check.ts --bundle --format=esm --platform=node --outfile=/tmp/check.mjs && node /tmp/check.mjs
 */
import { LEVELS, parseLevel, T } from "../src/game/levels";

const NAMES: Record<number, string> = {
  [T.EMPTY]: ".",
  [T.SOLID]: "#",
  [T.PLAT]: "-",
  [T.SPIKE]: "^",
  [T.CRUMBLE]: "f",
  [T.AMBUSH]: "A",
  [T.HIDDEN]: "h",
  [T.GHOST]: "w",
};

let problems = 0;
const fail = (msg: string) => {
  problems++;
  console.log("  ❌ " + msg);
};

for (const def of LEVELS) {
  const lv = parseLevel(def);
  console.log(`\n=== N${def.id} ${def.name} (${lv.cols}x${lv.rows}) ===`);
  const ruler = Array.from({ length: lv.cols }, (_, i) => (i % 10 === 0 ? String(Math.floor(i / 10) % 10) : " ")).join("");
  const ruler2 = Array.from({ length: lv.cols }, (_, i) => String(i % 10)).join("");
  console.log("  " + ruler);
  console.log("  " + ruler2);
  for (let y = 0; y < lv.rows; y++) {
    let line = "";
    for (let x = 0; x < lv.cols; x++) {
      let ch = NAMES[lv.tiles[y * lv.cols + x]] ?? "?";
      if (lv.start.x >> 4 === x && lv.start.y >> 4 === y) ch = "S";
      if (lv.goal && lv.goal.x >> 4 === x && lv.goal.y >> 4 === y) ch = "G";
      if (lv.goal2 && lv.goal2.x >> 4 === x && lv.goal2.y >> 4 === y) ch = "R";
      if (lv.decoy && lv.decoy.tx === x && lv.decoy.ty === y) ch = "X";
      const gem = lv.gems.find((g) => g.tx === x && g.ty === y);
      if (gem) ch = "*";
      line += ch;
    }
    console.log("  " + line);
  }
  console.log(
    `  movers=${lv.movers.length} pistons=${lv.pistons.length} gems=${lv.gems.length} pops=${lv.pops.length} ambush=${lv.ambushes.length} ghosts=${lv.ghosts.length} fragil=${lv.crumbles.length} decoy=${!!lv.decoy}`,
  );

  if (!lv.goal && !lv.goal2) fail("sin meta");
  if (lv.tiles0[lv.tiles0.length - 1] === undefined) fail("mapa vacío");

  // pinchos consecutivos (máximo saltable: 4 tiles)
  for (let y = 0; y < lv.rows; y++) {
    let run = 0;
    for (let x = 0; x <= lv.cols; x++) {
      const c = lv.tiles0[y * lv.cols + (x % lv.cols)];
      if (x < lv.cols && c === T.SPIKE) run++;
      else {
        if (run > 4) fail(`fila ${y}: ${run} pinchos seguidos (imposible)`);
        run = 0;
      }
    }
  }
  // pozos en la fila 14
  let pit = 0;
  for (let x = 0; x <= lv.cols; x++) {
    const c = x < lv.cols ? lv.tiles0[14 * lv.cols + x] : T.SOLID;
    const deadly = c === T.EMPTY || c === T.SPIKE || c === T.CRUMBLE;
    if (x < lv.cols && deadly) pit++;
    else {
      if (pit > 5) fail(`pozo de ${pit} tiles terminando en x=${x - 1}`);
      pit = 0;
    }
  }
}
console.log(`\nProblemas detectados: ${problems}`);
