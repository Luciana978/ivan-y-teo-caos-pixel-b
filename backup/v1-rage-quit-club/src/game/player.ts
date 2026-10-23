/**
 * player.ts — estado y comportamiento del personaje.
 * Controles con aceleración, coyote time, jump buffer y salto de altura variable.
 */

import { PHYS, TILE } from "./config";
import type { ParsedLevel } from "./levels";
import { clamp, moveBody, type Body } from "./physics";
import { moverUnder, type MoverRT, type TrapRuntime } from "./traps";

export type PlayerState = "idle" | "run" | "jump" | "fall" | "dead";

export type Player = Body & {
  vx: number;
  vy: number;
  onGround: boolean;
  coyote: number;
  buffer: number;
  facing: 1 | -1;
  anim: number;
  state: PlayerState;
  sx: number; // squash / stretch
  sy: number;
  jumping: boolean;
  rider: MoverRT | null;
  stepT: number;
  wasAir: number;
  feetTile: { tx: number; ty: number } | null;
};

export type PlayerHooks = {
  jump: () => void;
  land: (power: number) => void;
  step: () => void;
  dust: (x: number, y: number, count: number, color?: string) => void;
};

export function createPlayer(lv: ParsedLevel): Player {
  return {
    x: lv.start.x,
    y: lv.start.y,
    w: 10,
    h: 14,
    vx: 0,
    vy: 0,
    onGround: false,
    coyote: 0,
    buffer: 0,
    facing: 1,
    anim: 0,
    state: "idle",
    sx: 1,
    sy: 1,
    jumping: false,
    rider: null,
    stepT: 0,
    wasAir: 0,
    feetTile: null,
  };
}

export function resetPlayer(p: Player, lv: ParsedLevel) {
  p.x = lv.start.x;
  p.y = lv.start.y;
  p.vx = 0;
  p.vy = 0;
  p.onGround = false;
  p.coyote = 0;
  p.buffer = 0;
  p.facing = 1;
  p.anim = 0;
  p.state = "idle";
  p.sx = 1;
  p.sy = 1;
  p.jumping = false;
  p.rider = null;
  p.stepT = 0;
  p.wasAir = 0;
  p.feetTile = null;
}

export type PlayerInput = {
  left: boolean;
  right: boolean;
  jumpHeld: boolean;
  jumpPressed: boolean;
};

export function updatePlayer(
  p: Player,
  lv: ParsedLevel,
  rt: TrapRuntime,
  input: PlayerInput,
  dt: number,
  hooks: PlayerHooks,
) {
  /* --- arrastre de la plataforma en la que va montado --- */
  if (p.rider) {
    const dx = p.rider.x - p.rider.px;
    const dy = p.rider.y - p.rider.py;
    if (dx !== 0) {
      const r = moveBody(lv, p, dx, 0, true);
      if (r.hitWall) p.vx = 0;
    }
    if (dy !== 0) {
      const r = moveBody(lv, p, 0, dy, true);
      if (r.hitFloor) p.onGround = true;
    }
  }

  /* --- horizontal --- */
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  if (dir !== 0) {
    const accel = p.onGround ? PHYS.runAccel : PHYS.airAccel;
    p.vx += dir * accel * dt;
    p.facing = dir > 0 ? 1 : -1;
  } else {
    const f = (p.onGround ? PHYS.friction : PHYS.airDrag) * dt;
    if (Math.abs(p.vx) <= f) p.vx = 0;
    else p.vx -= Math.sign(p.vx) * f;
  }
  p.vx = clamp(p.vx, -PHYS.maxSpeed, PHYS.maxSpeed);

  /* --- salto: coyote + buffer --- */
  p.coyote = p.onGround ? PHYS.coyote : p.coyote - dt;
  p.buffer = input.jumpPressed ? PHYS.buffer : p.buffer - dt;
  if (p.buffer > 0 && p.coyote > 0) {
    p.vy = -PHYS.jumpVel;
    p.jumping = true;
    p.onGround = false;
    p.coyote = 0;
    p.buffer = 0;
    p.sx = 0.78;
    p.sy = 1.28;
    hooks.jump();
    hooks.dust(p.x + p.w / 2, p.y + p.h, 5, "#8b5cf6");
  }
  if (p.jumping && !input.jumpHeld && p.vy < 0) {
    p.vy *= PHYS.jumpCut;
    p.jumping = false;
  }

  /* --- gravedad con flotación en el ápice --- */
  const apex = Math.abs(p.vy) < 45;
  p.vy += PHYS.gravity * (apex ? 0.72 : 1) * dt;
  p.vy = Math.min(p.vy, PHYS.maxFall);

  /* --- eje X --- */
  const hx = moveBody(lv, p, p.vx * dt, 0, true);
  if (hx.hitWall) p.vx = 0;

  /* --- eje Y --- */
  const prevBottom = p.y + p.h;
  const res = moveBody(lv, p, 0, p.vy * dt, true);
  let landed = false;
  if (res.hitFloor) {
    if (!p.onGround && p.wasAir > 0.08) landed = true;
    p.onGround = true;
    p.vy = 0;
    p.jumping = false;
    p.feetTile = res.floorTile;
  } else {
    if (p.vy < 0) p.onGround = false;
    p.feetTile = null;
  }

  /* --- plataformas móviles --- */
  const m: MoverRT | null = moverUnder(rt, p, prevBottom);
  if (m && p.vy >= 0) {
    if (!p.onGround && p.wasAir > 0.08) landed = true;
    p.y = m.y - p.h;
    p.vy = 0;
    p.jumping = false;
    p.onGround = true;
    p.feetTile = null;
    p.rider = m;
    if (!m.active && m.def.mode === "onStep") {
      m.active = true;
      m.t = -0.1;
    }
    m.riding = true;
  } else {
    if (p.rider) p.rider.riding = false;
    p.rider = null;
  }

  /* --- animación / juice --- */
  p.wasAir = p.onGround ? 0 : p.wasAir + dt;
  if (landed) {
    p.sx = 1.32;
    p.sy = 0.68;
    hooks.land(Math.min(1, p.vy > 0 ? 0.6 : 0.45));
    hooks.dust(p.x + p.w / 2, p.y + p.h, 7, "#45e0e6");
  }
  p.sx += (1 - p.sx) * Math.min(1, dt * 12);
  p.sy += (1 - p.sy) * Math.min(1, dt * 12);
  p.anim += dt;

  if (p.onGround && Math.abs(p.vx) > 30) {
    p.stepT -= dt;
    if (p.stepT <= 0) {
      p.stepT = 0.19;
      hooks.step();
      hooks.dust(p.x + p.w / 2 - p.facing * 3, p.y + p.h - 1, 1, "#45e0e6");
    }
  }

  p.state = !p.onGround ? (p.vy < 0 ? "jump" : "fall") : Math.abs(p.vx) > 12 ? "run" : "idle";
}

/** Recorre el mapa buscando solapamiento con tiles mortales. */
export function touchingSpikes(lv: ParsedLevel, p: Body) {
  const x0 = Math.floor(p.x / TILE);
  const x1 = Math.floor((p.x + p.w - 1) / TILE);
  const y0 = Math.floor(p.y / TILE);
  const y1 = Math.floor((p.y + p.h - 1) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || tx >= lv.cols || ty < 0 || ty >= lv.rows) continue;
      if (lv.tiles[ty * lv.cols + tx] === 3) {
        // caja de daño algo menor que el tile para ser generosos
        const sx = tx * TILE + 2;
        const sy = ty * TILE + 3;
        if (p.x + p.w > sx && p.x < sx + 12 && p.y + p.h > sy && p.y < sy + 13) return true;
      }
    }
  }
  return false;
}
