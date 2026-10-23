/**
 * audio.ts — efectos sintetizados con Web Audio API.
 * Un único AudioContext creado perezosamente en el primer gesto del usuario.
 * Si la API no está disponible, el juego funciona igual (llamadas seguras).
 */

type ToneOpts = {
  f0: number;
  f1?: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
  sweep?: "lin" | "exp";
};

export class AudioKit {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  muted = false;

  get enabled() {
    return !!this.ctx && !this.muted;
  }

  /** Debe llamarse desde un gesto del usuario. Idempotente. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    try {
      const Ctor: typeof AudioContext =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
      // buffer de ruido reutilizable (evita crear buffers por efecto)
      const len = Math.floor(this.ctx.sampleRate * 0.4);
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.01);
    }
  }

  suspend() {
    if (this.ctx && this.ctx.state === "running") void this.ctx.suspend();
  }
  resume() {
    if (this.ctx && this.ctx.state === "suspended") void this.ctx.resume();
  }
  dispose() {
    if (this.ctx) void this.ctx.close().catch(() => {});
    this.ctx = null;
    this.master = null;
  }

  private tone(o: ToneOpts) {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || this.muted) return;
    const t = ctx.currentTime + (o.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = o.type ?? "square";
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1 !== undefined) {
      if (o.sweep === "exp") osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
      else osc.frequency.linearRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    }
    const peak = o.gain ?? 0.22;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
  }

  private noise(dur: number, gain = 0.2, freq = 1200, q = 1, delay = 0) {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noiseBuf || this.muted) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq;
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter).connect(g).connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  jump() {
    this.tone({ f0: 300, f1: 620, dur: 0.12, type: "square", gain: 0.16, sweep: "exp" });
  }
  land() {
    this.noise(0.07, 0.14, 420, 0.8);
    this.tone({ f0: 130, f1: 70, dur: 0.07, type: "triangle", gain: 0.12 });
  }
  gem() {
    this.tone({ f0: 880, dur: 0.06, type: "square", gain: 0.14 });
    this.tone({ f0: 1320, dur: 0.09, type: "square", gain: 0.12, delay: 0.05 });
  }
  trap() {
    this.tone({ f0: 180, f1: 90, dur: 0.18, type: "sawtooth", gain: 0.16 });
    this.noise(0.12, 0.12, 900, 1.2);
  }
  ghost() {
    this.tone({ f0: 700, f1: 160, dur: 0.3, type: "sawtooth", gain: 0.14, sweep: "exp" });
    this.noise(0.22, 0.1, 500, 0.7);
  }
  bonk() {
    this.tone({ f0: 220, f1: 80, dur: 0.14, type: "square", gain: 0.2 });
    this.noise(0.09, 0.16, 300, 0.6);
  }
  piston() {
    this.noise(0.16, 0.2, 240, 0.5);
    this.tone({ f0: 90, f1: 45, dur: 0.2, type: "square", gain: 0.18 });
  }
  death() {
    this.tone({ f0: 420, f1: 60, dur: 0.45, type: "sawtooth", gain: 0.2, sweep: "exp" });
    this.noise(0.3, 0.22, 700, 0.5);
    this.tone({ f0: 200, f1: 40, dur: 0.5, type: "square", gain: 0.12, delay: 0.04 });
  }
  win() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((f, i) => this.tone({ f0: f, dur: 0.16, type: "square", gain: 0.16, delay: i * 0.08 }));
    this.tone({ f0: 1568, dur: 0.35, type: "triangle", gain: 0.12, delay: 0.34 });
  }
  reveal() {
    this.tone({ f0: 300, f1: 1200, dur: 0.4, type: "triangle", gain: 0.14, sweep: "exp" });
  }
  click() {
    this.tone({ f0: 620, f1: 820, dur: 0.05, type: "square", gain: 0.1 });
  }
  step() {
    this.noise(0.04, 0.06, 260, 0.7);
  }
}

export const audio = new AudioKit();
