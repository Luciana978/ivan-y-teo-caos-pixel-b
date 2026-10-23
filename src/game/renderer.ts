/**
 * renderer.ts — dibujo en Canvas 2D. Todo el pixel art se genera por código:
 * no hay imágenes remotas ni spritesheets externos.
 * Resolución interna fija (480x240) escalada con `image-rendering: pixelated`.
 */

import { PAL, TILE, VIEW_H, VIEW_W } from "./config";
import { T, type ParsedLevel } from "./levels";
import { clamp, type Body } from "./physics";
import type { Particles } from "./particles";
import type { Player } from "./player";
import type { TrapRuntime } from "./traps";

export type RenderState = {
  lv: ParsedLevel;
  rt: TrapRuntime;
  player: Player;
  cam: { x: number; y: number };
  shake: { x: number; y: number };
  parts: Particles;
  time: number;
  flash: number;
  dead: boolean;
  deadT: number;
  hintAlpha: number;
  vignette: boolean;
};

/* ---------- fondo: estrellas y siluetas generadas por hash determinista ---------- */
const STARS = Array.from({ length: 70 }, (_, i) => {
  const h = (n: number) => {
    const s = Math.sin(n * 127.1) * 43758.5453;
    return s - Math.floor(s);
  };
  return { x: h(i + 1) * 1600, y: h(i + 7.3) * 150, s: h(i + 3.1) > 0.7 ? 2 : 1, p: h(i + 9.7) };
});
const SKYLINE = Array.from({ length: 60 }, (_, i) => {
  const h = (n: number) => {
    const s = Math.sin(n * 12.9898) * 43758.5453;
    return s - Math.floor(s);
  };
  return { x: i * 46, w: 22 + h(i + 2) * 26, h: 26 + h(i + 5) * 54, lit: h(i + 11) > 0.55 };
});

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

export function drawBackground(ctx: CanvasRenderingContext2D, s: RenderState) {
  const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  g.addColorStop(0, PAL.bgTop);
  g.addColorStop(1, PAL.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  const camX = s.cam.x;
  // estrellas
  for (const st of STARS) {
    const x = ((st.x - camX * 0.25) % 1600 + 1600) % 1600;
    if (x > VIEW_W + 4) continue;
    const tw = 0.6 + 0.4 * Math.sin(s.time * 2.2 + st.p * 9);
    ctx.fillStyle = st.s > 1 ? `rgba(69,224,230,${0.30 * tw})` : `rgba(244,240,232,${0.20 * tw})`;
    roundRect(ctx, x, st.y, st.s, st.s);
  }
  // silueta urbana en parallax
  const off = -((camX * 0.4) % 46);
  ctx.fillStyle = "rgba(34,34,56,0.85)";
  for (let i = 0; i < 14; i++) {
    const b = SKYLINE[(i + Math.floor((camX * 0.4) / 46) + 60) % SKYLINE.length];
    const x = off + i * 46;
    roundRect(ctx, x, VIEW_H - 30 - b.h, b.w, b.h + 30);
    if (b.lit) {
      ctx.fillStyle = "rgba(139,92,246,0.35)";
      roundRect(ctx, x + 4, VIEW_H - 26 - b.h + 4, 3, 3);
      roundRect(ctx, x + b.w - 9, VIEW_H - 26 - b.h + 10, 3, 3);
      ctx.fillStyle = "rgba(34,34,56,0.85)";
    }
  }
  // suelo de niebla
  const fg = ctx.createLinearGradient(0, VIEW_H - 60, 0, VIEW_H);
  fg.addColorStop(0, "rgba(17,17,27,0)");
  fg.addColorStop(1, "rgba(17,17,27,0.75)");
  ctx.fillStyle = fg;
  ctx.fillRect(0, VIEW_H - 60, VIEW_W, 60);
}

function drawSolid(ctx: CanvasRenderingContext2D, x: number, y: number, ambush: boolean) {
  ctx.fillStyle = ambush ? "#2b2540" : PAL.surface;
  roundRect(ctx, x, y, TILE, TILE);
  ctx.fillStyle = ambush ? "#3a3054" : PAL.surfaceLit;
  roundRect(ctx, x, y, TILE, 3);
  ctx.fillStyle = ambush ? "#191426" : "#181828";
  roundRect(ctx, x, y + TILE - 2, TILE, 2);
  if (ambush) {
    // grieta finísima: única pista visual (también hay aviso sonoro y de partículas)
    ctx.fillStyle = "rgba(255,138,61,0.30)";
    roundRect(ctx, x + 4, y + 8, 5, 1);
    roundRect(ctx, x + 9, y + 12, 4, 1);
  }
}

function drawSpike(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ctx.fillStyle = PAL.danger;
  for (let i = 0; i < 2; i++) {
    const bx = x + i * 8;
    ctx.beginPath();
    ctx.moveTo(bx + 0.5, y + TILE);
    ctx.lineTo(bx + 4, y + 3 + Math.sin(t * 6 + i) * 0.5);
    ctx.lineTo(bx + 7.5, y + TILE);
    ctx.closePath();
    ctx.fill();
  }
  ctx.fillStyle = PAL.death;
  for (let i = 0; i < 2; i++) {
    const bx = x + i * 8;
    roundRect(ctx, bx + 3, y + TILE - 4, 1, 3);
  }
}

function drawCrumble(ctx: CanvasRenderingContext2D, x: number, y: number, warn: number) {
  const sx = warn > 0 ? Math.sin(warn * 60) * 1.2 : 0;
  ctx.fillStyle = "#3b2f57";
  roundRect(ctx, x + sx, y, TILE, TILE);
  ctx.fillStyle = "#584a80";
  roundRect(ctx, x + sx, y, TILE, 3);
  ctx.fillStyle = "#191426";
  ctx.beginPath();
  ctx.moveTo(x + sx + 3, y + 3);
  ctx.lineTo(x + sx + 9, y + 9);
  ctx.lineTo(x + sx + 12, y + 13);
  ctx.strokeStyle = "#191426";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x + sx + 12, y + 4);
  ctx.lineTo(x + sx + 6, y + 11);
  ctx.stroke();
}

function drawShimmer(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, hidden: boolean) {
  const a = 0.25 + 0.35 * Math.abs(Math.sin(t * 18));
  ctx.fillStyle = hidden ? `rgba(255,138,61,${a})` : `rgba(139,92,246,${a})`;
  roundRect(ctx, x + 2, y + 2, TILE - 4, TILE - 4);
  ctx.strokeStyle = hidden ? PAL.danger : PAL.violet;
  ctx.lineWidth = 1;
  ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, TILE - 1, TILE - 1);
}

function drawPlatformSlab(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, glow: boolean) {
  ctx.fillStyle = PAL.surface;
  roundRect(ctx, x, y, w, h);
  ctx.fillStyle = glow ? PAL.cyan : PAL.surfaceLit;
  roundRect(ctx, x, y, w, 2);
  ctx.fillStyle = "#181828";
  roundRect(ctx, x, y + h - 1, w, 1);
  if (glow) {
    ctx.fillStyle = "rgba(69,224,230,0.18)";
    roundRect(ctx, x, y + h, w, 2);
  }
}

export function drawWorld(ctx: CanvasRenderingContext2D, s: RenderState) {
  const { lv, cam } = s;
  const camX = Math.round(cam.x);
  const camY = Math.round(cam.y);
  const tx0 = Math.max(0, Math.floor(camX / TILE) - 1);
  const tx1 = Math.min(lv.cols - 1, Math.floor((camX + VIEW_W) / TILE) + 1);
  const ty0 = 0;
  const ty1 = lv.rows - 1;

  ctx.save();
  ctx.translate(-camX + s.shake.x, -camY + s.shake.y);

  /* ---- tiles ---- */
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const code = lv.tiles[ty * lv.cols + tx];
      if (code === T.EMPTY) continue;
      const x = tx * TILE;
      const y = ty * TILE;
      switch (code) {
        case T.SOLID:
          drawSolid(ctx, x, y, false);
          break;
        case T.PLAT:
          drawPlatformSlab(ctx, x, y, TILE, 6, false);
          break;
        case T.SPIKE:
          drawSpike(ctx, x, y, s.time);
          break;
        case T.CRUMBLE:
          drawCrumble(ctx, x, y, 0);
          break;
        case T.AMBUSH:
          drawSolid(ctx, x, y, true);
          break;
        case T.HIDDEN:
        case T.GHOST: {
          // estado aviso: se dibuja shimmer; estado oculto: nada
          const grp =
            code === T.HIDDEN
              ? lv.pops.find((g) => g.tiles.includes(ty * lv.cols + tx))
              : lv.ghosts.find((g) => g.tiles.includes(ty * lv.cols + tx));
          if (grp && grp.state >= 1) drawShimmer(ctx, x, y, s.time, code === T.HIDDEN);
          break;
        }
      }
    }
  }

  /* ---- piso frágil cayendo ---- */
  for (const c of lv.crumbles) {
    if (c.state === 1) {
      drawCrumble(ctx, c.tx * TILE, c.ty * TILE, c.timer);
    } else if (c.state === 2) {
      const fall = c.timer * c.timer * 420;
      ctx.globalAlpha = clamp(1 - c.timer / 1.1, 0, 1);
      drawCrumble(ctx, c.tx * TILE, c.ty * TILE + fall, 0);
      ctx.globalAlpha = 1;
    }
  }

  /* ---- plataformas móviles ---- */
  for (const m of s.rt.movers) {
    drawPlatformSlab(ctx, m.x, m.y, m.w, m.h, m.active);
    // riel tenue
    ctx.fillStyle = "rgba(139,92,246,0.25)";
    if (m.def.axis === "x") roundRect(ctx, m.def.x * TILE, m.y + m.h + 1, (m.def.amp + m.def.w) * TILE, 1);
    else roundRect(ctx, m.x + m.w / 2 - 1, (m.def.y - m.def.amp) * TILE, 1, (m.def.amp + 1) * TILE);
  }

  /* ---- pistones ---- */
  for (const p of s.rt.pistons) {
    const x = p.x;
    const yTop = p.def.y * TILE;
    const headY = p.head.y;
    // shaft
    ctx.fillStyle = "#1b1b2c";
    roundRect(ctx, x + 5, yTop, TILE - 10, headY - yTop + 4);
    ctx.fillStyle = "#2f2f4a";
    roundRect(ctx, x + 6, yTop, 2, headY - yTop + 3);
    // cabeza
    ctx.fillStyle = p.warn ? PAL.danger : PAL.surfaceLit;
    roundRect(ctx, x, headY, TILE, TILE - 3);
    ctx.fillStyle = p.warn ? "#ffd166" : PAL.surfaceEdge;
    roundRect(ctx, x, headY, TILE, 2);
    // pinchos inferiores
    ctx.fillStyle = p.warn ? PAL.danger : PAL.death;
    for (let i = 0; i < 4; i++) roundRect(ctx, x + 1 + i * 4, headY + TILE - 4, 2, 4);
  }

  /* ---- gemas ---- */
  for (const gm of lv.gems) {
    if (gm.taken) continue;
    const bob = Math.sin(s.time * 3 + gm.tx * 0.7) * 1.5;
    const gx = gm.x + 5;
    const gy = gm.y + 5 + bob;
    ctx.fillStyle = PAL.gold;
    ctx.beginPath();
    ctx.moveTo(gx + 3, gy - 1);
    ctx.lineTo(gx + 6, gy + 3);
    ctx.lineTo(gx + 3, gy + 8);
    ctx.lineTo(gx, gy + 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    roundRect(ctx, gx + 2, gy, 1, 2);
    if (Math.sin(s.time * 5 + gm.tx) > 0.94) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      roundRect(ctx, gx - 2, gy + 2, 1, 1);
    }
  }

  /* ---- metas ---- */
  if (lv.goal) drawDoor(ctx, lv.goal.x, lv.goal.y, s.time, "real");
  if (lv.decoy && lv.decoy.state < 2) drawDoor(ctx, lv.decoy.tx * TILE, lv.decoy.ty * TILE, s.time, "fake");

  /* ---- pistas ---- */
  if (s.hintAlpha > 0.01 && lv.def.hints) {
    ctx.font = 'bold 6px "Courier New", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const h of lv.def.hints) {
      const x = h.x * TILE + TILE / 2;
      if (x < camX - 80 || x > camX + VIEW_W + 80) continue;
      const yy = h.y * TILE + 8;
      ctx.fillStyle = `rgba(11,11,18,${0.85 * s.hintAlpha})`; // sombra: legible sobre cualquier fondo
      ctx.fillText(h.text, x + 1, yy + 1);
      ctx.fillStyle = `rgba(244,240,232,${0.78 * s.hintAlpha})`;
      ctx.fillText(h.text, x, yy);
    }
    ctx.textAlign = "left";
  }

  /* ---- partículas ---- */
  drawParticles(ctx, s.parts);

  /* ---- jugador ---- */
  if (!s.dead || s.deadT < TIMING_DEAD_HIDE) drawPlayer(ctx, s.player, s.time, s.dead, s.deadT);

  ctx.restore();
}

const TIMING_DEAD_HIDE = 1.2;

function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, kind: "real" | "fake") {
  const pulse = 0.6 + 0.4 * Math.sin(t * 4);
  const flicker = kind === "fake" ? (Math.sin(t * 21) > 0.75 ? 0.25 : 1) : 1;
  const main = kind === "real" ? PAL.cyan : PAL.violet;
  const glow = kind === "real" ? PAL.cyan : "#ff4d6d";
  ctx.globalAlpha = flicker;
  // marco
  ctx.fillStyle = PAL.surface;
  roundRect(ctx, x + 1, y - TILE + 4, TILE - 2, TILE * 2 - 4);
  // interior
  ctx.fillStyle = main;
  roundRect(ctx, x + 4, y - TILE + 8, TILE - 8, TILE * 2 - 12);
  // luz
  ctx.globalAlpha = flicker * (0.25 + 0.25 * pulse);
  ctx.fillStyle = glow;
  roundRect(ctx, x - 2, y - TILE, TILE + 4, TILE * 2);
  ctx.globalAlpha = flicker;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  roundRect(ctx, x + 6, y - TILE + 10, 2, 3);
  roundRect(ctx, x + 9, y - TILE + 15, 2, 2);
  ctx.globalAlpha = 1;
}

function drawParticles(ctx: CanvasRenderingContext2D, parts: Particles) {
  for (const p of parts.pool) {
    if (!p.active) continue;
    const a = clamp(p.life / p.maxLife, 0, 1);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    const size = Math.max(1, Math.round(p.size * (p.kind === "chunk" ? a : 1)));
    if (p.kind === "ring") {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (1 - a) * 12 + 2, 0, Math.PI * 2);
      ctx.stroke();
    } else if (p.kind === "confetti") {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      roundRect(ctx, -size, -size / 2, size * 2, size);
      ctx.restore();
    } else {
      roundRect(ctx, p.x, p.y, size, size);
    }
  }
  ctx.globalAlpha = 1;
}

/** Sprite del personaje: 10x14 px, estados quieto / correr / saltar / caer / morir. */
export function drawPlayer(
  ctx: CanvasRenderingContext2D,
  p: Player,
  time: number,
  dead: boolean,
  deadT: number,
) {
  const runFrame = Math.floor(p.anim * 12) % 4;
  const bob = p.state === "run" ? [0, -1, 0, 0][runFrame] : p.state === "idle" ? Math.sin(time * 2.4) > 0.85 ? -1 : 0 : 0;
  const blink = p.state === "idle" && Math.sin(time * 1.7) > 0.97;

  ctx.save();
  const cx = p.x + p.w / 2;
  const cy = p.y + p.h;
  ctx.translate(Math.round(cx), Math.round(cy));
  if (dead) {
    const spin = deadT * 11;
    ctx.rotate(spin);
    ctx.globalAlpha = clamp(1.3 - deadT, 0, 1);
  }
  ctx.scale(p.facing * p.sx, p.sy);
  ctx.translate(-p.w / 2, -p.h);

  const X = 0;
  const Y = bob;
  const legA = p.state === "run" ? [0, -2, 0, 1][runFrame] : 0;
  const legB = p.state === "run" ? [0, 1, 0, -2][runFrame] : 0;
  const air = p.state === "jump" || p.state === "fall";
  const legSpread = air ? (p.state === "jump" ? -2 : 2) : 0;

  // piernas
  ctx.fillStyle = "#6d4bd8";
  roundRect(ctx, X + 2, Y + 10 + Math.max(0, legA), 2, 4 - Math.max(0, legA));
  roundRect(ctx, X + 6, Y + 10 + Math.max(0, legB), 2, 4 - Math.max(0, legB));
  if (air) {
    ctx.fillStyle = "#8b5cf6";
    roundRect(ctx, X + 1 + legSpread, Y + 9, 3, 4);
    roundRect(ctx, X + 6 - legSpread, Y + 9, 3, 4);
  }
  // cuerpo
  ctx.fillStyle = PAL.violet;
  roundRect(ctx, X + 2, Y + 6, 6, 5);
  ctx.fillStyle = PAL.cyan;
  roundRect(ctx, X + 3, Y + 7, 4, 1);
  // brazos
  ctx.fillStyle = "#f4f0e8";
  if (!air) {
    roundRect(ctx, X + 1, Y + 7 + (p.state === "run" ? legB : 0), 1, 3);
    roundRect(ctx, X + 8, Y + 7 + (p.state === "run" ? legA : 0), 1, 3);
  } else {
    roundRect(ctx, X + 8, Y + 5, 2, 1);
    roundRect(ctx, X, Y + 5, 2, 1);
  }
  // cabeza
  ctx.fillStyle = "#f4f0e8";
  roundRect(ctx, X + 1, Y + 1, 8, 5);
  ctx.fillStyle = "#11111b";
  roundRect(ctx, X + 3, Y + 2, 5, 3);
  // visor
  if (dead) {
    ctx.fillStyle = PAL.death;
    roundRect(ctx, X + 4, Y + 3, 1, 1);
    roundRect(ctx, X + 6, Y + 3, 1, 1);
  } else if (blink) {
    ctx.fillStyle = PAL.cyan;
    roundRect(ctx, X + 4, Y + 3, 3, 1);
  } else {
    ctx.fillStyle = PAL.cyan;
    roundRect(ctx, X + 4, Y + 3, 3, 1);
    ctx.fillStyle = "#f4f0e8";
    roundRect(ctx, X + 6, Y + 3, 1, 1);
  }
  // antena
  ctx.fillStyle = PAL.cyan;
  roundRect(ctx, X + 4, Y, 2, 1);
  ctx.restore();
}

/** Ilustración del personaje para el menú (escala entera, pixel nítido). */
export function drawCharacterPreview(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.clearRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  const scale = Math.max(2, Math.floor(Math.min(w / 14, h / 18)));
  const fake: Player = {
    x: 0,
    y: 0,
    w: 10,
    h: 14,
    vx: 0,
    vy: 0,
    onGround: true,
    coyote: 0,
    buffer: 0,
    facing: 1,
    anim: t,
    state: Math.sin(t * 0.9) > 0.55 ? "run" : "idle",
    sx: 1,
    sy: 1,
    jumping: false,
    rider: null,
    stepT: 0,
    wasAir: 0,
    feetTile: null,
  };
  ctx.save();
  ctx.translate(Math.round((w - 10 * scale) / 2), Math.round((h - 14 * scale) / 2) + 2);
  ctx.scale(scale, scale);
  drawPlayer(ctx, fake, t, false, 0);
  ctx.restore();
  // sombra
  ctx.fillStyle = "rgba(139,92,246,0.25)";
  ctx.fillRect(Math.round(w / 2 - 11), Math.round(h / 2 + 14 * scale / 2) + 3, 22, 2);
}

export function drawOverlayFx(ctx: CanvasRenderingContext2D, s: RenderState) {
  if (s.flash > 0.01) {
    ctx.fillStyle = `rgba(255,77,109,${clamp(s.flash, 0, 1) * 0.5})`;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
  if (s.vignette) {
    const g = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.85);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }
}

export function clearFrame(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = PAL.bgTop;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
}

export type { Body };
