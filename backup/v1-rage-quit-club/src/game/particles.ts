/**
 * particles.ts — sistema de partículas con pool fijo (sin GC por frame).
 */

export type PKind = "dust" | "spark" | "chunk" | "confetti" | "ring" | "gem";

export type Particle = {
  active: boolean;
  kind: PKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  grav: number;
  rot: number;
  vrot: number;
};

const MAX = 260;

export class Particles {
  pool: Particle[] = [];

  constructor() {
    for (let i = 0; i < MAX; i++) {
      this.pool.push({
        active: false,
        kind: "dust",
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        size: 2,
        color: "#fff",
        grav: 0,
        rot: 0,
        vrot: 0,
      });
    }
  }

  private get(): Particle | null {
    for (let i = 0; i < MAX; i++) if (!this.pool[i].active) return this.pool[i];
    return null;
  }

  spawn(
    kind: PKind,
    x: number,
    y: number,
    opts: Partial<Omit<Particle, "active" | "kind" | "x" | "y">> = {},
  ) {
    const p = this.get();
    if (!p) return;
    p.active = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = opts.vx ?? 0;
    p.vy = opts.vy ?? 0;
    p.maxLife = opts.maxLife ?? 0.5;
    p.life = p.maxLife;
    p.size = opts.size ?? 2;
    p.color = opts.color ?? "#f4f0e8";
    p.grav = opts.grav ?? 0;
    p.rot = opts.rot ?? 0;
    p.vrot = opts.vrot ?? 0;
  }

  burst(
    x: number,
    y: number,
    count: number,
    opts: Partial<Omit<Particle, "x" | "y" | "active" | "kind">> & {
      spread?: number;
      speed?: number;
      kind?: PKind;
    } = {},
  ) {
    const spread = opts.spread ?? Math.PI * 2;
    const speed = opts.speed ?? 90;
    for (let i = 0; i < count; i++) {
      const a = spread === Math.PI * 2 ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * spread;
      const s = speed * (0.5 + Math.random() * 0.8);
      this.spawn(opts.kind ?? "spark", x, y, {
        ...opts,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        maxLife: (opts.maxLife ?? 0.5) * (0.7 + Math.random() * 0.6),
        size: (opts.size ?? 2) * (0.7 + Math.random() * 0.7),
        vrot: (Math.random() - 0.5) * 12,
      });
    }
  }

  update(dt: number) {
    for (let i = 0; i < MAX; i++) {
      const p = this.pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;
      if (p.kind === "dust" || p.kind === "spark") {
        p.vx *= 1 - 2.4 * dt;
        p.vy *= 1 - 1.2 * dt;
      }
    }
  }

  clear() {
    for (const p of this.pool) p.active = false;
  }
}
