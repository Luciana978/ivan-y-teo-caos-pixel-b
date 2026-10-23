/**
 * storage.ts — persistencia local versionada y validada.
 * Si localStorage no está disponible (modo privado, error de cuota), el juego
 * sigue funcionando en memoria durante la sesión.
 */

import { GAME_ID, SCORE } from "./config";

export type LevelRecord = {
  cleared: boolean;
  bestTime: number | null; // segundos
  bestDeaths: number | null;
  bestScore: number;
  bestGems: number;
};

export type ScoreEntry = {
  score: number;
  level: number;
  levelName: string;
  time: number;
  deaths: number;
  date: number;
};

export type SaveData = {
  v: 2;
  levels: Record<string, LevelRecord>;
  totalDeaths: number;
  totalClears: number;
  scores: ScoreEntry[];
  muted: boolean;
};

const KEY = `${GAME_ID}.save.v2`;
const EMPTY_LEVEL: LevelRecord = {
  cleared: false,
  bestTime: null,
  bestDeaths: null,
  bestScore: 0,
  bestGems: 0,
};

function emptySave(): SaveData {
  return { v: 2, levels: {}, totalDeaths: 0, totalClears: 0, scores: [], muted: false };
}

function num(v: unknown, fallback: number | null = null): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;
}

/** Valida y normaliza lo leído. Nunca lanza. */
function sanitize(raw: unknown): SaveData {
  const out = emptySave();
  if (!raw || typeof raw !== "object") return out;
  const r = raw as Record<string, unknown>;
  if (r.v !== 2) return out;
  if (typeof r.totalDeaths === "number") out.totalDeaths = Math.max(0, Math.floor(r.totalDeaths));
  if (typeof r.totalClears === "number") out.totalClears = Math.max(0, Math.floor(r.totalClears));
  out.muted = r.muted === true;
  if (r.levels && typeof r.levels === "object") {
    for (const [k, val] of Object.entries(r.levels as Record<string, unknown>)) {
      if (!val || typeof val !== "object") continue;
      const l = val as Record<string, unknown>;
      out.levels[k] = {
        cleared: l.cleared === true,
        bestTime: num(l.bestTime),
        bestDeaths: num(l.bestDeaths),
        bestScore: num(l.bestScore) ?? 0,
        bestGems: num(l.bestGems) ?? 0,
      };
    }
  }
  if (Array.isArray(r.scores)) {
    for (const s of r.scores) {
      if (!s || typeof s !== "object") continue;
      const e = s as Record<string, unknown>;
      const score = num(e.score) ?? -1;
      if (score < 0) continue;
      out.scores.push({
        score,
        level: num(e.level, 1) ?? 1,
        levelName: typeof e.levelName === "string" ? e.levelName.slice(0, 40) : "",
        time: num(e.time, 0) ?? 0,
        deaths: num(e.deaths, 0) ?? 0,
        date: num(e.date, 0) ?? 0,
      });
    }
  }
  out.scores.sort((a, b) => b.score - a.score);
  out.scores = out.scores.slice(0, SCORE.maxTableEntries);
  return out;
}

let cache: SaveData = emptySave();
let memoryOnly = false;

export const storage = {
  get memoryOnly() {
    return memoryOnly;
  },
  load(): SaveData {
    try {
      const raw = localStorage.getItem(KEY);
      cache = raw ? sanitize(JSON.parse(raw)) : emptySave();
    } catch {
      cache = emptySave();
      memoryOnly = true;
    }
    return cache;
  },
  save(data: SaveData) {
    cache = data;
    if (memoryOnly) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch {
      memoryOnly = true;
    }
  },
  level(id: number, data: SaveData): LevelRecord {
    return data.levels[String(id)] ?? EMPTY_LEVEL;
  },
  isUnlocked(id: number, data: SaveData): boolean {
    if (id <= 1) return true;
    return !!storage.level(id - 1, data).cleared;
  },
  highestUnlocked(data: SaveData, total = 10): number {
    let last = 1;
    for (let i = 1; i <= total; i++) {
      if (storage.level(i, data).cleared) last = Math.min(total, i + 1);
    }
    return last;
  },
  reset() {
    cache = emptySave();
    if (memoryOnly) return;
    try {
      localStorage.removeItem(KEY);
    } catch {
      memoryOnly = true;
    }
  },
};
