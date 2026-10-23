/**
 * game.ts — bucle de juego, máquina de estados, cámara, puntaje y récords.
 * La física corre a paso fijo (120 Hz) acumulando delta; el render usa rAF.
 */

import { PHYS, SCORE, TILE, TIMING, VIEW_H, VIEW_W } from "./config";
import { DEATH_MESSAGES, LEVELS, parseLevel, T, type ParsedLevel } from "./levels";
import { clamp, lerp, overlap, type Body } from "./physics";
import { Particles } from "./particles";
import { createPlayer, resetPlayer, touchingSpikes, updatePlayer, type Player } from "./player";
import { drawBackground, drawOverlayFx, drawWorld } from "./renderer";
import { storage, type SaveData } from "./storage";
import {
  createTraps,
  pistonDeadly,
  resetTraps,
  updateTraps,
  type SfxName,
  type TrapRuntime,
  type BurstOpts,
} from "./traps";
import { audio } from "./audio";

export type Phase = "menu" | "playing" | "dying" | "paused" | "complete" | "gamecomplete";

export type HudState = {
  levelIndex: number;
  levelName: string;
  time: number;
  deaths: number;
  gems: number;
  gemsTotal: number;
  score: number;
  bestTime: number | null;
};

export type CompleteState = {
  levelIndex: number;
  time: number;
  deaths: number;
  gems: number;
  score: number;
  bestTime: number | null;
  newRecord: boolean;
  flawless: boolean;
  isLast: boolean;
  headline: string;
};

export type UiSnapshot = {
  phase: Phase;
  save: SaveData;
  complete: CompleteState | null;
  deathMsg: string | null;
  muted: boolean;
  memoryOnly: boolean;
  runsStarted: number;
};

const GOAL_W = 12;

function goalRect(g: { x: number; y: number }): Body {
  return { x: g.x + 2, y: g.y - 12, w: GOAL_W, h: 28 };
}

export class Game {
  private ctx: CanvasRenderingContext2D;
  private lv: ParsedLevel;
  private rt: TrapRuntime;
  private player: Player;
  private parts = new Particles();
  private raf = 0;
  private last = 0;
  private acc = 0;
  private time = 0; // tiempo del nivel (congelado en pausa)
  private clock = 0; // tiempo visual global
  private cam = { x: 0, y: 0 };
  private shakeMag = 0;
  private shake = { x: 0, y: 0 };
  private flash = 0;
  private deadT = 0;
  private stateT = 0;
  private hintAlpha = 1;
  private hintT = 0;
  private deathMsg: string | null = null;
  private complete: CompleteState | null = null;
  private save: SaveData;
  private levelIndex = 0;
  private levelTime = 0;
  private levelDeaths = 0;
  private gemsTaken = 0;
  private runsStarted = 0;
  private hudT = 0;
  private destroyed = false;
  phase: Phase = "menu";
  muted = false;

  constructor(
    canvas: HTMLCanvasElement,
    private input: {
      isDown: (b: "left" | "right" | "jump") => boolean;
      jumpPressed: boolean;
      jumpHeld: boolean;
      endFrame: () => void;
      flush: () => void;
    },
    private onUi: (s: UiSnapshot) => void,
    private onHud: (h: HudState) => void,
  ) {
    canvas.width = VIEW_W;
    canvas.height = VIEW_H;
    const c = canvas.getContext("2d", { alpha: false });
    if (!c) throw new Error("Canvas 2D no disponible");
    this.ctx = c;
    this.ctx.imageSmoothingEnabled = false;
    this.save = storage.load();
    this.muted = this.save.muted;
    audio.setMuted(this.muted);
    this.lv = parseLevel(LEVELS[0]);
    this.rt = createTraps(this.lv);
    this.player = createPlayer(this.lv);
    resetTraps(this.lv, this.rt);
    resetPlayer(this.player, this.lv);
    this.centerCamera();
    document.addEventListener("visibilitychange", this.onVisibility);
  }

  /* ------------------------------------------------------------------ */
  /* ciclo                                                              */
  /* ------------------------------------------------------------------ */

  start() {
    this.last = performance.now();
    const loop = (now: number) => {
      if (this.destroyed) return;
      this.raf = requestAnimationFrame(loop);
      let dt = (now - this.last) / 1000;
      this.last = now;
      if (dt > TIMING.maxDelta) dt = TIMING.maxDelta;
      this.clock += dt;
      if (this.phase === "playing" || this.phase === "dying") {
        this.acc += dt;
        let guard = 0;
        while (this.acc >= PHYS.step && guard < 12) {
          this.step(PHYS.step);
          this.acc -= PHYS.step;
          guard++;
        }
        if (guard >= 12) this.acc = 0;
      }
      this.updateFx(dt);
      this.render();
      this.input.endFrame();
      this.hudT -= dt;
      if (this.hudT <= 0 && (this.phase === "playing" || this.phase === "dying")) {
        this.hudT = 0.1;
        this.emitHud();
      }
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  private onVisibility = () => {
    if (document.hidden) {
      if (this.phase === "playing") this.pause();
      this.last = performance.now();
      this.acc = 0;
    } else {
      this.last = performance.now();
      this.acc = 0;
    }
  };

  /* ------------------------------------------------------------------ */
  /* simulación                                                         */
  /* ------------------------------------------------------------------ */

  private step(dt: number) {
    if (this.phase === "dying") {
      this.deadT += dt;
      this.stateT -= dt;
      if (this.stateT <= 0) this.respawn();
      return;
    }
    if (this.phase !== "playing") return;

    this.time += dt;
    this.levelTime += dt;
    this.hintT += dt;
    this.hintAlpha = clamp(1 - (this.hintT - 7) / 2, 0.15, 1);

    // trampas (posiciones y estados)
    updateTraps(this.lv, this.rt, this.player, this.player.feetTile, this.time, dt, this.hooks);

    updatePlayer(this.player, this.lv, this.rt, this.inputSnapshot(), dt, {
      jump: () => {
        audio.jump();
        this.shakeMag = Math.max(this.shakeMag, 1.2);
      },
      land: () => {
        audio.land();
        this.shakeMag = Math.max(this.shakeMag, 1.8);
      },
      step: () => audio.step(),
      dust: (x, y, n, color) => this.dust(x, y, n, color),
    });

    this.checkInteractions();
    this.updateCamera(dt);
  }

  private inputSnapshot() {
    return {
      left: this.input.isDown("left"),
      right: this.input.isDown("right"),
      jumpHeld: this.input.jumpHeld,
      jumpPressed: this.input.jumpPressed,
    };
  }

  private checkInteractions() {
    const p = this.player;
    const lv = this.lv;

    // gemas
    for (const g of lv.gems) {
      if (g.taken) continue;
      if (overlap(p, { x: g.x + 4, y: g.y + 3, w: 8, h: 10 })) {
        g.taken = true;
        this.gemsTaken++;
        audio.gem();
        this.parts.burst(g.x + 8, g.y + 8, 8, { color: "#ffd166", kind: "spark", speed: 80, maxLife: 0.4 });
        this.parts.spawn("ring", g.x + 8, g.y + 8, { color: "#ffd166", size: 1, maxLife: 0.3 });
      }
    }

    // meta
    if (lv.goal && overlap(p, goalRect(lv.goal))) {
      this.win();
      return;
    }

    // meta falsa
    if (lv.decoy && lv.decoy.state === 0 && overlap(p, goalRect({ x: lv.decoy.tx * TILE, y: lv.decoy.ty * TILE }))) {
      lv.decoy.state = 1;
      lv.decoy.timer = 0;
      audio.trap();
      this.shakeMag = Math.max(this.shakeMag, 3);
      this.deathMsg = null;
    }
    if (lv.decoy && lv.decoy.state === 1) {
      lv.decoy.timer += PHYS.step;
      if (lv.decoy.timer > 0.34) {
        lv.decoy.state = 2;
        const idx = lv.decoy.ty * lv.cols + lv.decoy.tx;
        lv.tiles[idx] = T.SPIKE;
        if (lv.goal2) lv.goal = { x: lv.goal2.x, y: lv.goal2.y };
        audio.reveal();
        audio.ghost();
        this.shakeMag = Math.max(this.shakeMag, 5);
        this.parts.burst(lv.decoy.tx * TILE + 8, lv.decoy.ty * TILE, 16, {
          color: "#ff4d6d",
          kind: "spark",
          speed: 130,
        });
        if (lv.goal2) {
          this.parts.burst(lv.goal2.x + 8, lv.goal2.y + 8, 20, { color: "#45e0e6", kind: "confetti", speed: 120, grav: 200 });
        }
        this.deathMsg = "ESA NO ERA LA SALIDA";
        this.stateT = 1.6;
      }
    }

    // peligros
    if (touchingSpikes(lv, p) || pistonDeadly(this.rt, p)) {
      this.kill("spike");
      return;
    }
    if (p.y > lv.h + 24) {
      this.kill("void");
      return;
    }
  }

  private hooks = {
    sfx: (n: SfxName) => {
      if (n === "crumble") audio.trap();
      else if (n === "reveal") audio.reveal();
      else audio[n]();
    },
    shake: (a: number) => {
      this.shakeMag = Math.max(this.shakeMag, a);
    },
    burst: (x: number, y: number, count: number, opts: BurstOpts) => {
      this.parts.burst(x, y, count, opts);
    },
    kill: () => {
      this.kill("trap");
    },
    note: () => {},
  };

  private dust(x: number, y: number, n: number, color = "#45e0e6") {
    this.parts.burst(x, y, n, { color, kind: "dust", speed: 46, maxLife: 0.34, size: 2, spread: Math.PI * 0.9 });
  }

  /* ------------------------------------------------------------------ */
  /* muerte / reinicio / victoria                                       */
  /* ------------------------------------------------------------------ */

  kill(reason: string) {
    if (this.phase !== "playing") return; // una sola muerte por evento
    this.phase = "dying";
    this.deadT = 0;
    this.stateT = TIMING.deathDelay;
    this.player.state = "dead";
    this.player.vx = 0;
    this.levelDeaths++;
    this.save.totalDeaths++;
    this.persist();
    audio.death();
    this.shakeMag = 9;
    this.flash = 1;
    const cx = this.player.x + this.player.w / 2;
    const cy = this.player.y + this.player.h / 2;
    this.parts.burst(cx, cy, 22, { color: PAL_DEATH, kind: "chunk", speed: 170, grav: 620, size: 3, maxLife: 0.8 });
    this.parts.burst(cx, cy, 12, { color: "#ff8a3d", kind: "spark", speed: 120, maxLife: 0.5 });
    this.parts.spawn("ring", cx, cy, { color: PAL_DEATH, size: 2, maxLife: 0.45 });
    const pool = [...(this.lv.def.msgs ?? []), ...DEATH_MESSAGES];
    this.deathMsg = pool[Math.floor(Math.random() * pool.length)] ?? "La física no negocia.";
    void reason;
    this.emitUi();
  }

  private respawn() {
    resetTraps(this.lv, this.rt);
    resetPlayer(this.player, this.lv);
    // las gemas ya recogidas se conservan dentro del intento del nivel
    this.parts.clear();
    this.deathMsg = null;
    this.flash = 0.2;
    this.phase = "playing";
    this.stateT = 0;
    this.centerCamera();
    audio.click();
    this.emitUi();
  }

  private win() {
    if (this.phase !== "playing") return;
    this.phase = "complete";
    audio.win();
    this.shakeMag = 4;
    const cx = this.player.x + this.player.w / 2;
    const cy = this.player.y;
    this.parts.burst(cx, cy, 40, { color: "#45e0e6", kind: "confetti", speed: 170, grav: 320, maxLife: 1.4 });
    this.parts.burst(cx, cy, 24, { color: "#8b5cf6", kind: "confetti", speed: 130, grav: 300, maxLife: 1.4 });
    this.parts.burst(cx, cy, 16, { color: "#ffd166", kind: "spark", speed: 120, maxLife: 0.8 });

    const time = this.levelTime;
    const deaths = this.levelDeaths;
    const score = Math.max(
      0,
      this.gemsTaken * SCORE.gem +
        SCORE.clear +
        Math.max(0, SCORE.timeBonusBase - Math.floor(time) * SCORE.timeBonusPerSec) +
        (deaths === 0 ? SCORE.flawless : 0) -
        deaths * SCORE.deathPenalty,
    );

    const id = String(this.lv.def.id);
    const rec = this.save.levels[id] ?? {
      cleared: false,
      bestTime: null,
      bestDeaths: null,
      bestScore: 0,
      bestGems: 0,
    };
    const newRecord = rec.bestTime === null || time < rec.bestTime;
    this.save.levels[id] = {
      cleared: true,
      bestTime: rec.bestTime === null ? time : Math.min(rec.bestTime, time),
      bestDeaths: rec.bestDeaths === null ? deaths : Math.min(rec.bestDeaths, deaths),
      bestScore: Math.max(rec.bestScore, score),
      bestGems: Math.max(rec.bestGems, this.gemsTaken),
    };
    this.save.totalClears++;
    this.save.scores.push({
      score,
      level: this.lv.def.id,
      levelName: this.lv.def.name,
      time,
      deaths,
      date: Date.now(),
    });
    this.save.scores.sort((a, b) => b.score - a.score);
    this.save.scores = this.save.scores.slice(0, SCORE.maxTableEntries);
    this.persist();

    const isLast = this.lv.def.id === LEVELS.length;
    const par = this.lv.def.parTime;
    let headline = "NIVEL SUPERADO";
    if (deaths === 0) headline = "IMPECABLE. SOSPECHOSO.";
    else if (time < par) headline = "RÁPIDO Y SUCIO";
    else if (deaths < 5) headline = "SOBREVIVISTE";
    else headline = "TERMINASTE. COSTÓ.";
    if (isLast) {
      headline = "CLUB COMPLETO. FELICIDADES.";
      this.phase = "gamecomplete";
    }

    this.complete = {
      levelIndex: this.levelIndex,
      time,
      deaths,
      gems: this.gemsTaken,
      score,
      bestTime: this.save.levels[id].bestTime,
      newRecord,
      flawless: deaths === 0,
      isLast,
      headline,
    };
    this.stateT = TIMING.winDelay;
    this.emitUi();
  }

  private persist() {
    storage.save(this.save);
  }

  /* ------------------------------------------------------------------ */
  /* acciones públicas (UI)                                             */
  /* ------------------------------------------------------------------ */

  playLevel(index: number) {
    const i = Math.max(0, Math.min(LEVELS.length - 1, index));
    if (!storage.isUnlocked(LEVELS[i].id, this.save)) return;
    this.loadLevel(i);
    this.phase = "playing";
    this.runsStarted++;
    audio.unlock();
    audio.click();
    this.input.flush();
    this.emitUi();
    this.emitHud();
  }

  nextLevel() {
    if (this.levelIndex + 1 < LEVELS.length) this.playLevel(this.levelIndex + 1);
    else this.toMenu();
  }

  restartLevel() {
    if (this.phase === "menu") return;
    this.levelTime = 0;
    this.levelDeaths = 0;
    this.gemsTaken = 0;
    for (const g of this.lv.gems) g.taken = false;
    this.loadLevel(this.levelIndex);
    this.phase = "playing";
    audio.click();
    this.input.flush();
    this.emitUi();
    this.emitHud();
  }

  pause() {
    if (this.phase !== "playing" && this.phase !== "dying") return;
    this.phase = "paused";
    audio.suspend();
    this.emitUi();
  }

  resume() {
    if (this.phase !== "paused") return;
    this.phase = "playing";
    this.last = performance.now();
    this.acc = 0;
    this.input.flush();
    audio.resume();
    this.emitUi();
  }

  togglePause() {
    if (this.phase === "paused") this.resume();
    else this.pause();
  }

  toggleMute() {
    this.muted = !this.muted;
    audio.unlock();
    audio.setMuted(this.muted);
    this.save.muted = this.muted;
    this.persist();
    if (!this.muted) audio.click();
    this.emitUi();
  }

  toMenu() {
    this.phase = "menu";
    this.complete = null;
    this.deathMsg = null;
    this.loadLevel(this.levelIndex);
    audio.resume();
    this.emitUi();
  }

  resetProgress() {
    storage.reset();
    this.save = storage.load();
    this.emitUi();
  }

  get isTouchUi() {
    return typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  }

  /* ------------------------------------------------------------------ */
  /* internos                                                           */
  /* ------------------------------------------------------------------ */

  private loadLevel(index: number) {
    this.levelIndex = index;
    this.lv = parseLevel(LEVELS[index]);
    this.rt = createTraps(this.lv);
    this.player = createPlayer(this.lv);
    resetTraps(this.lv, this.rt);
    resetPlayer(this.player, this.lv);
    this.parts.clear();
    this.time = 0;
    this.levelTime = 0;
    this.levelDeaths = 0;
    this.gemsTaken = 0;
    this.deathMsg = null;
    this.complete = null;
    this.deadT = 0;
    this.hintT = 0;
    this.hintAlpha = 1;
    this.flash = 0.25;
    this.shakeMag = 0;
    this.centerCamera();
  }

  private centerCamera() {
    const target = this.player.x + this.player.w / 2 - VIEW_W / 2;
    this.cam.x = clamp(target, 0, Math.max(0, this.lv.w - VIEW_W));
    this.cam.y = 0;
  }

  private updateCamera(dt: number) {
    const p = this.player;
    const target = p.x + p.w / 2 + p.facing * 26 - VIEW_W / 2;
    const maxX = Math.max(0, this.lv.w - VIEW_W);
    const want = clamp(target, 0, maxX);
    this.cam.x = lerp(this.cam.x, want, Math.min(1, dt * 7));
    if (Math.abs(this.cam.x - want) < 0.4) this.cam.x = want;
    this.cam.y = 0;
  }

  private updateFx(dt: number) {
    this.parts.update(dt);
    this.shakeMag = Math.max(0, this.shakeMag - this.shakeMag * TIMING.shakeDecay * dt - 0.4 * dt);
    const s = this.shakeMag;
    this.shake.x = (Math.random() * 2 - 1) * s;
    this.shake.y = (Math.random() * 2 - 1) * s;
    this.flash = Math.max(0, this.flash - dt * 3.2);
    if (this.phase === "complete" || this.phase === "gamecomplete") {
      this.deadT += dt;
    }
    if (this.deathMsg && this.lv.decoy && this.lv.decoy.state === 2) {
      this.stateT -= dt;
      if (this.stateT <= 0) this.deathMsg = null;
    }
  }

  private render() {
    const ctx = this.ctx;
    drawBackground(ctx, {
      lv: this.lv,
      rt: this.rt,
      player: this.player,
      cam: this.cam,
      shake: this.shake,
      parts: this.parts,
      time: this.clock,
      flash: this.flash,
      dead: this.phase === "dying",
      deadT: this.deadT,
      hintAlpha: this.phase === "playing" || this.phase === "dying" ? this.hintAlpha : 0,
      vignette: true,
    });
    drawWorld(ctx, {
      lv: this.lv,
      rt: this.rt,
      player: this.player,
      cam: this.cam,
      shake: this.shake,
      parts: this.parts,
      time: this.clock,
      flash: this.flash,
      dead: this.phase === "dying",
      deadT: this.deadT,
      hintAlpha: this.phase === "playing" || this.phase === "dying" ? this.hintAlpha : 0,
      vignette: true,
    });
    drawOverlayFx(ctx, {
      lv: this.lv,
      rt: this.rt,
      player: this.player,
      cam: this.cam,
      shake: this.shake,
      parts: this.parts,
      time: this.clock,
      flash: this.flash,
      dead: this.phase === "dying",
      deadT: this.deadT,
      hintAlpha: 0,
      vignette: true,
    });
  }

  /** Instantánea legible por la UI (React). */
  snapshot(): UiSnapshot {
    return {
      phase: this.phase,
      save: this.save,
      complete: this.complete,
      deathMsg: this.deathMsg,
      muted: this.muted,
      memoryOnly: storage.memoryOnly,
      runsStarted: this.runsStarted,
    };
  }

  private emitUi() {
    this.onUi({
      phase: this.phase,
      save: this.save,
      complete: this.complete,
      deathMsg: this.deathMsg,
      muted: this.muted,
      memoryOnly: storage.memoryOnly,
      runsStarted: this.runsStarted,
    });
  }

  private emitHud() {
    this.onHud({
      levelIndex: this.levelIndex,
      levelName: this.lv.def.name,
      time: this.levelTime,
      deaths: this.levelDeaths,
      gems: this.gemsTaken,
      gemsTotal: this.lv.gems.length,
      score: this.currentScore(),
      bestTime: storage.level(this.lv.def.id, this.save).bestTime,
    });
  }

  private currentScore() {
    return Math.max(
      0,
      this.gemsTaken * SCORE.gem +
        Math.max(0, SCORE.timeBonusBase - Math.floor(this.levelTime) * SCORE.timeBonusPerSec) -
        this.levelDeaths * SCORE.deathPenalty,
    );
  }

  /** Usado por la UI para saber si hay que mostrar controles táctiles. */
  get levelCount() {
    return LEVELS.length;
  }

  get moverCount() {
    return this.rt.movers.length;
  }
}

const PAL_DEATH = "#ff4d6d";
