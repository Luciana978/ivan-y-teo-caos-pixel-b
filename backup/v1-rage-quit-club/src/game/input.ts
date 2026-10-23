/**
 * input.ts — teclado + botones táctiles.
 * Los botones táctiles no dejan estados trabados: se limpian en blur,
 * visibilitychange, touchcancel y al cambiar de nivel.
 */

export type Btn = "left" | "right" | "jump";

const KEYMAP: Record<string, Btn> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  Space: "jump",
  ArrowUp: "jump",
  KeyW: "jump",
};

const PREVENT = new Set([
  "Space",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyA",
  "KeyD",
  "KeyW",
  "KeyR",
  "KeyM",
  "KeyP",
]);

export class Input {
  private down: Record<Btn, boolean> = { left: false, right: false, jump: false };
  private prevJump = false;
  private keyDown = new Set<string>();
  /** eventos de una sola pulsación, consumidos por el juego */
  queue: string[] = [];

  onKey?: (code: string) => void;

  private handleDown = (e: KeyboardEvent) => {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (PREVENT.has(e.code)) e.preventDefault();
    if (e.repeat) return;
    this.keyDown.add(e.code);
    const btn = KEYMAP[e.code];
    if (btn) this.down[btn] = true;
    this.queue.push(e.code);
    this.onKey?.(e.code);
  };

  private handleUp = (e: KeyboardEvent) => {
    this.keyDown.delete(e.code);
    const btn = KEYMAP[e.code];
    if (btn) {
      // sólo soltar si no queda otra tecla física que mapée al mismo botón
      const stillDown = Object.entries(KEYMAP).some(([code, b]) => b === btn && this.keyDown.has(code));
      if (!stillDown) this.down[btn] = false;
    }
  };

  private clear = () => {
    this.keyDown.clear();
    this.down.left = this.down.right = this.down.jump = false;
  };

  private onBlur = () => this.clear();
  private onVis = () => {
    if (document.hidden) this.clear();
  };

  attach() {
    window.addEventListener("keydown", this.handleDown, { passive: false });
    window.addEventListener("keyup", this.handleUp);
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onVis);
  }

  detach() {
    window.removeEventListener("keydown", this.handleDown);
    window.removeEventListener("keyup", this.handleUp);
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onVis);
    this.clear();
  }

  /** Llamado por los botones táctiles. */
  setButton(btn: Btn, value: boolean) {
    this.down[btn] = value;
    if (value && btn === "jump") this.queue.push("TouchJump");
  }

  isDown(b: Btn) {
    return this.down[b];
  }
  get jumpHeld() {
    return this.down.jump;
  }
  /** salto recién presionado (edge) */
  get jumpPressed() {
    const p = this.down.jump && !this.prevJump;
    return p;
  }
  endFrame() {
    this.prevJump = this.down.jump;
  }
  consume(code: string) {
    const i = this.queue.indexOf(code);
    if (i >= 0) this.queue.splice(i, 1);
  }
  flush() {
    this.queue.length = 0;
  }
}
