/**
 * physics.ts + collision.ts — consulta de tiles y resolución AABB.
 * Simulación a paso fijo: la velocidad máxima por paso (~4px) es menor que un
 * tile, así que la resolución por ejes es suficiente y no hay tunelado.
 */

import { T, type ParsedLevel } from "./levels";
import { TILE } from "./config";

export type Body = { x: number; y: number; w: number; h: number };

export const SOLID_CODES = [T.SOLID, T.CRUMBLE, T.AMBUSH, T.GHOST];

export function isSolidCode(code: number) {
  return code === T.SOLID || code === T.CRUMBLE || code === T.AMBUSH || code === T.GHOST;
}

/** Código de tile con límites: los costados son muros, arriba y abajo están abiertos. */
export function tileAt(lv: ParsedLevel, tx: number, ty: number): number {
  if (tx < 0 || tx >= lv.cols) return T.SOLID;
  if (ty < 0 || ty >= lv.rows) return T.EMPTY;
  return lv.tiles[ty * lv.cols + tx];
}

export function tileCodeAtPx(lv: ParsedLevel, x: number, y: number) {
  return tileAt(lv, Math.floor(x / TILE), Math.floor(y / TILE));
}

function solidForX(code: number) {
  return isSolidCode(code);
}

function solidForFloor(code: number) {
  return isSolidCode(code) || code === T.PLAT;
}

/** Zona mortal: pinchos, pinchos ocultos brotados y pinchos de emboscada. */
export function isDeadlyCode(code: number) {
  return code === T.SPIKE;
}

export function overlap(a: Body, b: Body) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export type HitResult = {
  hitWall: boolean;
  hitFloor: boolean;
  hitCeil: boolean;
  floorTile: { tx: number; ty: number } | null;
};

/**
 * Mueve el cuerpo resolviendo contra el mapa de tiles.
 * `oneWayFrom` es el borde inferior previo (para plataformas de un sentido).
 */
export function moveBody(
  lv: ParsedLevel,
  b: Body,
  dx: number,
  dy: number,
  allowOneWay: boolean,
): HitResult {
  const res: HitResult = { hitWall: false, hitFloor: false, hitCeil: false, floorTile: null };

  // --- eje X ---
  if (dx !== 0) {
    b.x += dx;
    const y0 = Math.floor(b.y / TILE);
    const y1 = Math.floor((b.y + b.h - 1) / TILE);
    if (dx > 0) {
      const tx = Math.floor((b.x + b.w - 1) / TILE);
      for (let ty = y0; ty <= y1; ty++) {
        if (solidForX(tileAt(lv, tx, ty))) {
          b.x = tx * TILE - b.w;
          res.hitWall = true;
          break;
        }
      }
    } else {
      const tx = Math.floor(b.x / TILE);
      for (let ty = y0; ty <= y1; ty++) {
        if (solidForX(tileAt(lv, tx, ty))) {
          b.x = (tx + 1) * TILE;
          res.hitWall = true;
          break;
        }
      }
    }
  }

  // --- eje Y ---
  if (dy !== 0) {
    const prevBottom = b.y + b.h;
    b.y += dy;
    const x0 = Math.floor(b.x / TILE);
    const x1 = Math.floor((b.x + b.w - 1) / TILE);
    if (dy > 0) {
      const ty = Math.floor((b.y + b.h - 1) / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        const code = tileAt(lv, tx, ty);
        const oneWayOk = code === T.PLAT && allowOneWay && prevBottom <= ty * TILE + 1;
        if (solidForFloor(code) && (code !== T.PLAT || oneWayOk)) {
          b.y = ty * TILE - b.h;
          res.hitFloor = true;
          res.floorTile = { tx, ty };
          break;
        }
      }
    } else {
      const ty = Math.floor(b.y / TILE);
      for (let tx = x0; tx <= x1; tx++) {
        if (solidForX(tileAt(lv, tx, ty))) {
          b.y = (ty + 1) * TILE;
          res.hitCeil = true;
          break;
        }
      }
    }
  }
  return res;
}

/** ¿Hay suelo sólido justo debajo del cuerpo? (para coyote time / riders) */
export function groundedOn(lv: ParsedLevel, b: Body, tolerance = 1) {
  const y = b.y + b.h + tolerance;
  const x0 = Math.floor((b.x + 1) / TILE);
  const x1 = Math.floor((b.x + b.w - 2) / TILE);
  const ty = Math.floor(y / TILE);
  for (let tx = x0; tx <= x1; tx++) {
    if (solidForFloor(tileAt(lv, tx, ty))) return true;
  }
  return false;
}

/** Push horizontal fuera de una pared recién materializada (bonk, no muerte). */
export function pushOutOfWalls(lv: ParsedLevel, b: Body, fromX: number) {
  const x0 = Math.floor(b.x / TILE);
  const x1 = Math.floor((b.x + b.w - 1) / TILE);
  const y0 = Math.floor(b.y / TILE);
  const y1 = Math.floor((b.y + b.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (!solidForX(tileAt(lv, tx, ty))) continue;
      const left = tx * TILE;
      const right = left + TILE;
      const toLeft = Math.abs(b.x + b.w - left);
      const toRight = Math.abs(right - b.x);
      if (fromX <= left || toLeft <= toRight) b.x = left - b.w - 0.01;
      else b.x = right + 0.01;
      return true;
    }
  }
  return false;
}

export function clamp(v: number, a: number, b: number) {
  return v < a ? a : v > b ? b : v;
}
export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
/** onda triangular 0→1→0 (movimiento de plataformas) */
export function tri(t: number) {
  const m = ((t % 1) + 1) % 1;
  return 1 - Math.abs(1 - 2 * m);
}
export function easeInOut(t: number) {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
