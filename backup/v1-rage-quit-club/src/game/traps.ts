/**
 * traps.ts — trampas, plataformas móviles y pistones.
 * Regla de diseño: toda trampa es reproducible y avisada (telegrafía breve).
 * El estado del mapa vive en `lv.tiles`, así que la colisión nunca se desincroniza.
 */

import { TILE, TIMING, TRAP } from "./config";
import { T, type Group, type ParsedLevel } from "./levels";
import { clamp, easeInOut, overlap, pushOutOfWalls, tri, type Body } from "./physics";

export type SfxName = "trap" | "ghost" | "bonk" | "piston" | "reveal" | "crumble";

export type TrapHooks = {
  sfx: (name: SfxName) => void;
  shake: (amount: number) => void;
  burst: (x: number, y: number, count: number, opts: BurstOpts) => void;
  kill: (reason: string) => void;
  note: (text: string) => void;
};

export type BurstOpts = {
  color?: string;
  kind?: "dust" | "spark" | "chunk" | "confetti" | "ring" | "gem";
  speed?: number;
  spread?: number;
  size?: number;
  grav?: number;
  maxLife?: number;
};

export type MoverRT = {
  def: { x: number; y: number; w: number; axis: "x" | "y"; amp: number; period: number; mode: "always" | "onStep"; phase?: number };
  x: number;
  y: number;
  w: number;
  h: number;
  px: number;
  py: number;
  active: boolean;
  t: number;
  riding: boolean;
};

export type PistonRT = {
  def: { x: number; y: number; len: number; period: number; phase: number };
  k: number; // 0 = arriba, 1 = abajo
  warn: boolean;
  head: Body;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type TrapRuntime = {
  movers: MoverRT[];
  pistons: PistonRT[];
  warnedPiston: boolean[];
};

/*
 * Ciclo del pistón (proporciones del período):
 *   0.00–0.50  arriba (ventana segura)
 *   0.50–0.62  golpe: baja rápido
 *   0.62–0.74  abajo, sostenido
 *   0.74–1.00  retrae
 * Queda arriba ~60% del ciclo: siempre hay ventana de paso.
 */
const PISTON_SLAM = 0.5;
const PISTON_SLAM_END = 0.62;
const PISTON_HOLD_END = 0.74;
const PISTON_WARN_AT = 0.38; // flash de aviso antes del golpe

export function createTraps(lv: ParsedLevel): TrapRuntime {
  return {
    movers: lv.movers.map((m) => ({
      def: m,
      x: m.x * TILE,
      y: m.y * TILE,
      w: m.w * TILE,
      h: 8,
      px: m.x * TILE,
      py: m.y * TILE,
      active: m.mode === "always",
      t: m.mode === "always" ? (m.phase ?? 0) * m.period : -0.12,
      riding: false,
    })),
    pistons: lv.pistons.map((p) => ({
      def: p,
      k: 0,
      warn: false,
      head: { x: p.x * TILE, y: p.y * TILE, w: TILE, h: TILE },
      x: p.x * TILE,
      y: p.y * TILE,
      w: TILE,
      h: p.len * TILE,
    })),
    warnedPiston: lv.pistons.map(() => false),
  };
}

export function resetTraps(lv: ParsedLevel, rt: TrapRuntime) {
  lv.tiles.set(lv.tiles0);
  for (const g of [...lv.pops, ...lv.ambushes, ...lv.ghosts]) {
    g.state = 0;
    g.timer = 0;
  }
  for (const c of lv.crumbles) {
    c.state = 0;
    c.timer = 0;
  }
  if (lv.decoy) {
    lv.decoy.state = 0;
    lv.decoy.timer = 0;
  }
  if (lv.goal2 && lv.goal && lv.goal !== lv.goal2) lv.goal = null;
  for (let i = 0; i < rt.movers.length; i++) {
    const m = rt.movers[i];
    m.active = m.def.mode === "always";
    m.t = m.def.mode === "always" ? (m.def.phase ?? 0) * m.def.period : -0.12;
    m.x = m.def.x * TILE;
    m.y = m.def.y * TILE;
    m.px = m.x;
    m.py = m.y;
    m.riding = false;
  }
  rt.warnedPiston.fill(false);
}

function groupBounds(lv: ParsedLevel, g: Group) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const idx of g.tiles) {
    const tx = idx % lv.cols;
    const ty = Math.floor(idx / lv.cols);
    minX = Math.min(minX, tx * TILE);
    maxX = Math.max(maxX, (tx + 1) * TILE);
    minY = Math.min(minY, ty * TILE);
    maxY = Math.max(maxY, (ty + 1) * TILE);
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Actualiza trampas. `feetTile` es el tile bajo los pies del jugador (o null).
 * Devuelve el roce de pared fantasma para el feedback de "bonk".
 */
export function updateTraps(
  lv: ParsedLevel,
  rt: TrapRuntime,
  player: Body,
  feetTile: { tx: number; ty: number } | null,
  time: number,
  dt: number,
  hooks: TrapHooks,
) {
  const pcx = player.x + player.w / 2;
  const pbottom = player.y + player.h;

  /* ---------------- pinchos ocultos (por tramos) ---------------- */
  for (const g of lv.pops) {
    const b = groupBounds(lv, g);
    if (g.state === 0) {
      const nearX = pcx > b.minX - TRAP.popRange && pcx < b.maxX + TRAP.popRange;
      const nearY = pbottom > b.minY - TRAP.popVertRange && pbottom < b.maxY + 28;
      if (nearX && nearY) {
        g.state = 1;
        g.timer = 0;
        hooks.sfx("trap");
        hooks.burst((b.minX + b.maxX) / 2, b.minY + 6, 6, { color: "#ff8a3d", kind: "dust", speed: 60 });
      }
    } else if (g.state === 1) {
      g.timer += dt;
      if (Math.random() < dt * 40) {
        hooks.burst(b.minX + Math.random() * (b.maxX - b.minX), b.minY + 12, 1, {
          color: "#ff8a3d",
          kind: "dust",
          speed: 40,
        });
      }
      if (g.timer >= TRAP.popWarn) {
        g.state = 2;
        for (const idx of g.tiles) lv.tiles[idx] = T.SPIKE;
        hooks.sfx("piston");
        hooks.shake(3.5);
        hooks.burst((b.minX + b.maxX) / 2, b.minY + 8, 12, { color: "#ff8a3d", kind: "spark", speed: 130 });
      }
    }
  }

  /* ---------------- piso emboscado ---------------- */
  for (const g of lv.ambushes) {
    const b = groupBounds(lv, g);
    if (g.state === 0) {
      const onIt =
        !!feetTile &&
        feetTile.ty === Math.round(b.minY / TILE) &&
        pcx >= b.minX - 2 &&
        pcx <= b.maxX + 2;
      if (onIt) {
        g.state = 1;
        g.timer = 0;
        hooks.sfx("trap");
        hooks.note("¡cuidado!");
      }
    } else if (g.state === 1) {
      g.timer += dt;
      if (Math.random() < dt * 30) {
        hooks.burst(b.minX + Math.random() * (b.maxX - b.minX), b.minY + 2, 1, {
          color: "#ff8a3d",
          kind: "dust",
          speed: 35,
        });
      }
      if (g.timer >= TRAP.ambushWarn) {
        g.state = 2;
        for (const idx of g.tiles) lv.tiles[idx] = T.SPIKE;
        hooks.sfx("piston");
        hooks.shake(4.5);
        hooks.burst((b.minX + b.maxX) / 2, b.minY + 4, 16, { color: "#ff8a3d", kind: "spark", speed: 120 });
      }
    }
  }

  /* ---------------- pared fantasma ---------------- */
  for (const g of lv.ghosts) {
    const b = groupBounds(lv, g);
    if (g.state === 0) {
      const near = pcx > b.minX - TRAP.ghostRange && pcx < b.maxX + TRAP.ghostRange;
      const nearY = pbottom > b.minY - TILE * 2 && player.y < b.maxY + TILE;
      if (near && nearY) {
        g.state = 1;
        g.timer = 0;
        hooks.sfx("ghost");
      }
    } else if (g.state === 1) {
      g.timer += dt;
      if (g.timer >= TRAP.ghostWarn) {
        g.state = 2;
        for (const idx of g.tiles) lv.tiles[idx] = T.SOLID;
        hooks.shake(5);
        if (overlap(player, { x: b.minX, y: b.minY, w: b.maxX - b.minX, h: b.maxY - b.minY })) {
          if (pushOutOfWalls(lv, player, pcx)) {
            hooks.sfx("bonk");
            hooks.note("¡pared!");
          }
        }
        hooks.burst(b.minX + TILE / 2, b.minY + TILE, 14, { color: "#8b5cf6", kind: "spark", speed: 150 });
      }
    }
  }

  /* ---------------- piso frágil ---------------- */
  for (const c of lv.crumbles) {
    const tx = c.tx;
    const ty = c.ty;
    if (c.state === 0) {
      const onIt =
        !!feetTile &&
        Math.abs(feetTile.tx - tx) <= 0 &&
        feetTile.ty === ty &&
        pcx >= tx * TILE - 2 &&
        pcx <= (tx + 1) * TILE + 2;
      if (onIt) {
        c.state = 1;
        c.timer = 0;
        hooks.sfx("crumble" as SfxName);
      }
    } else if (c.state === 1) {
      c.timer += dt;
      if (c.timer >= TRAP.crumbleWarn) {
        c.state = 2;
        lv.tiles[c.idx] = T.EMPTY;
        c.timer = 0;
        hooks.burst(tx * TILE + TILE / 2, ty * TILE + TILE / 2, 7, {
          color: "#8b5cf6",
          kind: "chunk",
          speed: 70,
          grav: 700,
          size: 3,
        });
        hooks.shake(2.2);
      }
    } else if (c.state === 2) {
      c.timer += dt;
    }
  }

  /* ---------------- pistones ---------------- */
  rt.pistons.forEach((p, i) => {
    const c = ((time / p.def.period + p.def.phase) % 1 + 1) % 1;
    let k: number;
    if (c < PISTON_SLAM) k = 0;
    else if (c < PISTON_SLAM_END) k = easeInOut((c - PISTON_SLAM) / (PISTON_SLAM_END - PISTON_SLAM));
    else if (c < PISTON_HOLD_END) k = 1;
    else k = 1 - easeInOut((c - PISTON_HOLD_END) / (1 - PISTON_HOLD_END));
    p.k = k;
    p.warn = c > PISTON_WARN_AT && c < PISTON_SLAM;
    const top = (p.def.y + p.def.len * k) * TILE;
    p.head.y = top;
    const near = Math.abs(pcx - (p.head.x + TILE / 2)) < 150;
    if (p.warn && !rt.warnedPiston[i]) {
      rt.warnedPiston[i] = true;
      if (near) {
        hooks.sfx("trap");
        hooks.burst(p.head.x + TILE / 2, top + 2, 3, { color: "#ff8a3d", kind: "dust", speed: 40 });
      }
    }
    if (!p.warn && c < 0.9) rt.warnedPiston[i] = false;
    if (k > 0.06 && overlap(player, p.head) && near) {
      hooks.kill("piston");
    }
  });

  /* ---------------- plataformas móviles ---------------- */
  for (const m of rt.movers) {
    m.px = m.x;
    m.py = m.y;
    if (m.active) m.t += dt;
    const off = tri(Math.max(0, m.t) / m.def.period) * m.def.amp * TILE;
    if (m.def.axis === "x") m.x = m.def.x * TILE + off;
    else m.y = m.def.y * TILE - off;
    if (m.active && !m.riding && Math.abs(m.x - m.px) < 0.01 && Math.abs(m.y - m.py) < 0.01) {
      // recién activada: aviso sonoro único
    }
  }
}

/** Plataforma bajo el jugador (para montarse). */
export function moverUnder(rt: TrapRuntime, player: Body, prevBottom: number): MoverRT | null {
  for (const m of rt.movers) {
    if (
      player.x + player.w > m.x + 1 &&
      player.x < m.x + m.w - 1 &&
      prevBottom <= m.y + 6 &&
      player.y + player.h >= m.y &&
      player.y + player.h <= m.y + 14
    ) {
      return m;
    }
  }
  return null;
}

export function pistonDeadly(rt: TrapRuntime, player: Body) {
  for (const p of rt.pistons) {
    if (p.k > 0.06 && overlap(player, p.head)) return true;
  }
  return false;
}

export function deathDelay() {
  return TIMING.deathDelay;
}

export function clampLevel(lv: ParsedLevel, v: number) {
  return clamp(v, 0, lv.w);
}
