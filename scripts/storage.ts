/**
 * scripts/storage.ts — pruebas del guardado local (sólo desarrollo). npm run test:storage
 * Simula localStorage en Node: datos válidos, corruptos, de otra versión, maliciosos y bloqueado.
 */
import { GAME_ID } from "../src/game/config";
import { storage, type SaveData } from "../src/game/storage";

let fails = 0;
const check = (name: string, ok: boolean, note = "") => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${note ? "  -> " + note : ""}`);
};

const KEY = `${GAME_ID}.save.v2`;
const mem = new Map<string, string>();
let blocked: "none" | "get" | "set" = "none";
(globalThis as unknown as { localStorage: Storage }).localStorage = {
  getItem: (k: string) => {
    if (blocked === "get") throw new Error("SecurityError");
    return mem.get(k) ?? null;
  },
  setItem: (k: string, v: string) => {
    if (blocked === "set") throw new Error("QuotaExceededError");
    mem.set(k, v);
  },
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: () => null,
  length: 0,
} as Storage;

check("la clave de guardado es la de Iván & Teo", KEY === "ivan-teo-caos-pixel.save.v2", KEY);
mem.set("rage-quit-club.save.v2", JSON.stringify({ v: 2, totalDeaths: 99 }));

// 1. sin datos
let d = storage.load();
check("sin datos: arranca limpio y NO lee el guardado del MVP anterior", d.totalDeaths === 0 && Object.keys(d.levels).length === 0);

// 2. ida y vuelta
d.levels["1"] = { cleared: true, bestTime: 12.5, bestDeaths: 2, bestScore: 4000, bestGems: 3 };
d.totalDeaths = 7;
d.scores.push({ score: 4000, level: 1, levelName: "X", time: 12.5, deaths: 2, date: 1 });
storage.save(d);
d = storage.load();
check("ida y vuelta conserva nivel, tiempo, muertes y tabla", d.levels["1"]?.bestTime === 12.5 && d.totalDeaths === 7 && d.scores.length === 1);
check("N1 completado desbloquea N2 y no N3", storage.isUnlocked(2, d) && !storage.isUnlocked(3, d));
check("highestUnlocked = 2", storage.highestUnlocked(d, 10) === 2);

// 3. datos inválidos
const bad: Array<[string, string]> = [
  ["JSON roto", "{no es json"],
  ["valor nulo", "null"],
  ["array", "[1,2,3]"],
  ["versión distinta", JSON.stringify({ v: 1, totalDeaths: 50 })],
  ["números negativos / texto", JSON.stringify({ v: 2, totalDeaths: -5, levels: { "1": { cleared: "yes", bestTime: -3, bestScore: "9999" } }, scores: [{ score: "x" }, null, 5] })],
  ["niveles no-objeto", JSON.stringify({ v: 2, levels: { "1": 7, "2": null }, scores: "nada" })],
];
for (const [name, raw] of bad) {
  mem.set(KEY, raw);
  let ok = true;
  let out: SaveData | null = null;
  try {
    out = storage.load();
  } catch {
    ok = false;
  }
  const sane = !!out && out.totalDeaths >= 0 && out.scores.every((s) => s.score >= 0) && Object.values(out.levels).every((l) => l.bestScore >= 0 && (l.bestTime === null || l.bestTime >= 0) && typeof l.cleared === "boolean");
  check(`dato inválido (${name}) no rompe y queda normalizado`, ok && sane);
}
mem.set(KEY, JSON.stringify({ v: 2, totalDeaths: -5, levels: { "1": { cleared: "yes" } } }));
d = storage.load();
check("cleared='yes' (no booleano) NO desbloquea niveles", !storage.isUnlocked(2, d));

// 4. tabla ordenada y acotada
const many = { v: 2, scores: Array.from({ length: 20 }, (_, i) => ({ score: i * 10, level: 1, levelName: "n", time: 1, deaths: 0, date: i })) };
mem.set(KEY, JSON.stringify(many));
d = storage.load();
check("tabla de marcas limitada a 8 y ordenada de mayor a menor", d.scores.length === 8 && d.scores[0].score === 190 && d.scores[7].score === 120);

// 5. almacenamiento bloqueado (modo privado / cuota)
blocked = "get";
d = storage.load();
check("localStorage bloqueado al leer: sigue jugable y avisa (memoryOnly)", storage.memoryOnly && d.totalDeaths === 0);
d.totalDeaths = 3;
storage.save(d);
check("guardar en modo memoria no lanza", true);
blocked = "none";

console.log(fails ? `\n${fails} falla(s)` : "\nTodas las pruebas de guardado OK");
process.exit(fails ? 1 : 0);
