import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Input } from "@/game/input";
import { audio } from "@/game/audio";
import { VIEW_H, VIEW_W } from "@/game/config";
import { Game, type HudState, type UiSnapshot } from "@/game/game";
import { LEVELS } from "@/game/levels";
import { storage } from "@/game/storage";
import { fmtTime } from "@/game/share";
import { Btn } from "@/ui/kit";
import { CompleteScreen, MenuScreen, PauseScreen } from "@/ui/screens";
import { cn } from "@/utils/cn";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<Game | null>(null);
  const inputRef = useRef<Input | null>(null);
  const [ui, setUi] = useState<UiSnapshot | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [size, setSize] = useState({ w: VIEW_W, h: VIEW_H });
  const [isTouch, setIsTouch] = useState(false);

  /* ------------------------- init del motor ------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const input = new Input();
    input.attach();
    inputRef.current = input;

    const game = new Game(
      canvas,
      input,
      (s) => setUi({ ...s }),
      (h) => setHud({ ...h }),
    );
    gameRef.current = game;
    setUi({
      phase: "menu",
      save: storage.load(),
      complete: null,
      deathMsg: null,
      muted: game.muted,
      memoryOnly: storage.memoryOnly,
      runsStarted: 0,
    });
    game.start();
    setIsTouch(window.matchMedia("(pointer: coarse)").matches);

    return () => {
      game.destroy();
      input.detach();
      gameRef.current = null;
    };
  }, []);

  /* --------------------- escalado nítido del canvas --------------------- */
  const resize = useCallback(() => {
    const wrap = stageRef.current;
    if (!wrap) return;
    const aw = wrap.clientWidth;
    const ah = wrap.clientHeight;
    if (aw <= 0 || ah <= 0) return;
    let scale = Math.min(aw / VIEW_W, ah / VIEW_H);
    scale = scale >= 1 ? Math.min(4, Math.floor(scale * 2) / 2) : Math.max(0.5, scale);
    setSize({ w: Math.round(VIEW_W * scale), h: Math.round(VIEW_H * scale) });
  }, []);

  useLayoutEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (stageRef.current) ro.observe(stageRef.current);
    window.addEventListener("orientationchange", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", resize);
    };
  }, [resize]);

  /* --------------------------- acciones UI --------------------------- */
  const actions = {
    play: (i: number) => {
      audio.unlock();
      gameRef.current?.playLevel(i);
    },
    resume: () => gameRef.current?.resume(),
    restart: () => gameRef.current?.restartLevel(),
    next: () => gameRef.current?.nextLevel(),
    toMenu: () => gameRef.current?.toMenu(),
    toggleMute: () => gameRef.current?.toggleMute(),
    resetProgress: () => gameRef.current?.resetProgress(),
  };

  /* --------------------------- teclado global --------------------------- */
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    input.onKey = (code) => {
      const g = gameRef.current;
      if (!g) return;
      audio.unlock();
      const phase = g.phase;
      if (code === "KeyM") {
        g.toggleMute();
        return;
      }
      if (code === "KeyR") {
        if (phase === "playing" || phase === "dying" || phase === "paused") g.restartLevel();
        return;
      }
      if (code === "Escape" || code === "KeyP") {
        if (phase === "playing" || phase === "dying") g.pause();
        else if (phase === "paused") g.resume();
        return;
      }
      if (code === "Enter" || code === "NumpadEnter" || code === "Space" || code === "KeyN") {
        if (phase === "menu") actions.play(Math.max(0, Math.min(LEVELS.length - 1, storage.highestUnlocked(g.snapshot().save, LEVELS.length) - 1)));
        else if (phase === "paused") g.resume();
        else if (phase === "complete") g.nextLevel();
        else if (phase === "gamecomplete") g.playLevel(0);
      }
    };
  }, [ui?.phase]);

  const phase = ui?.phase ?? "menu";
  const showHud = phase === "playing" || phase === "dying" || phase === "paused";
  const levelName = hud?.levelName ?? LEVELS[0].name;

  return (
    <div className="rtc-root">
      <div className="rtc-cabinet">
        {/* ---------------- barra superior ---------------- */}
        <header className="rtc-topbar">
          <div className="flex min-w-0 items-center gap-2">
            <span className="rtc-tag">RAGE QUIT CLUB</span>
            {showHud && hud && (
              <span className="truncate text-[10px] uppercase tracking-[0.18em] text-white/50">
                N{LEVELS[hud.levelIndex].id} · {hud.levelName}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {showHud && hud && (
              <>
                <span className="rtc-hudval" title="Tiempo del nivel">
                  <i className="rtc-dot rtc-dot-cyan" /> {fmtTime(hud.time)}
                </span>
                <span className="rtc-hudval" title="Muertes">
                  <i className="rtc-dot rtc-dot-red" /> {hud.deaths}
                </span>
                <span className="rtc-hudval hidden sm:flex" title="Gemas">
                  <i className="rtc-dot rtc-dot-gold" /> {hud.gems}/{hud.gemsTotal}
                </span>
                <span className="rtc-hudval hidden sm:flex" title="Puntos">
                  <i className="rtc-dot rtc-dot-violet" /> {hud.score}
                </span>
              </>
            )}
            <button
              type="button"
              aria-label={ui?.muted ? "Activar sonido" : "Silenciar"}
              onClick={() => actions.toggleMute()}
              className={cn("rtc-iconbtn", ui?.muted && "rtc-iconbtn-off")}
            >
              {ui?.muted ? "MUTE" : "SND"}
            </button>
            <button
              type="button"
              aria-label="Pausar"
              onClick={() => gameRef.current?.togglePause()}
              disabled={!showHud}
              className="rtc-iconbtn"
            >
              {phase === "paused" ? "PLAY" : "PAUSE"}
            </button>
          </div>
        </header>

        {/* ---------------- escenario ---------------- */}
        <div ref={stageRef} className="rtc-stage">
          <div className="relative" style={{ width: size.w, height: size.h }}>
            <canvas
              ref={canvasRef}
              className="rtc-pixel rtc-canvas"
              style={{ width: size.w, height: size.h }}
              aria-label="Escenario del juego"
            />
            <div className="rtc-scanlines" aria-hidden="true" />
          </div>

          {/* capa de interfaz sobre el escenario completo */}
          <div className="rtc-overlay">
            {phase === "dying" && ui?.deathMsg && (
              <div className="rtc-death pointer-events-none">
                <span className="rtc-death-title">MORISTE</span>
                <span className="rtc-death-msg">{ui.deathMsg}</span>
                <span className="rtc-death-hint">Reinicia con R</span>
              </div>
            )}

            {/* aviso de modo sin almacenamiento */}
            {ui?.memoryOnly && (
              <div className="rtc-warn pointer-events-none">Sin almacenamiento: el progreso dura esta sesión</div>
            )}

            {/* pantallas */}
            {phase === "menu" && ui && <MenuScreen save={ui.save} actions={actions} muted={!!ui.muted} />}
            {phase === "paused" && ui && (
              <PauseScreen actions={actions} muted={!!ui.muted} levelName={levelName} />
            )}
            {(phase === "complete" || phase === "gamecomplete") && ui?.complete && (
              <CompleteScreen
                levelId={LEVELS[ui.complete.levelIndex].id}
                levelName={LEVELS[ui.complete.levelIndex].name}
                time={ui.complete.time}
                deaths={ui.complete.deaths}
                gems={ui.complete.gems}
                gemsTotal={hud?.gemsTotal ?? 0}
                score={ui.complete.score}
                bestTime={ui.complete.bestTime}
                newRecord={ui.complete.newRecord}
                headline={ui.complete.headline}
                finished={phase === "gamecomplete"}
                totalDeaths={ui.save.totalDeaths}
                totalScore={LEVELS.reduce((a, l) => a + (ui.save.levels[String(l.id)]?.bestScore ?? 0), 0)}
                actions={actions}
              />
            )}
          </div>
        </div>

        {/* ---------------- controles táctiles ---------------- */}
        <div className={cn("rtc-pad", !isTouch && "rtc-pad-hidden")}>
          <div className="rtc-pad-group">
            <TouchBtn label="Izquierda" onDown={(v) => inputRef.current?.setButton("left", v)}>
              <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden="true">
                <path d="M10.5 3L5 8l5.5 5" stroke="currentColor" strokeWidth="2.2" fill="none" />
              </svg>
            </TouchBtn>
            <TouchBtn label="Derecha" onDown={(v) => inputRef.current?.setButton("right", v)}>
              <svg viewBox="0 0 16 16" className="h-5 w-5" aria-hidden="true">
                <path d="M5.5 3L11 8l-5.5 5" stroke="currentColor" strokeWidth="2.2" fill="none" />
              </svg>
            </TouchBtn>
          </div>
          <div className="flex items-center gap-2">
            <TouchBtn label="Reiniciar" onDown={(v) => v && actions.restart()} small>
              <span className="text-[10px] tracking-widest">RETRY</span>
            </TouchBtn>
            <TouchBtn label="Saltar" onDown={(v) => inputRef.current?.setButton("jump", v)} big>
              <span className="text-[11px] tracking-[0.2em]">SALTO</span>
            </TouchBtn>
          </div>
        </div>

        {/* ---------------- pie con controles de teclado ---------------- */}
        <footer className={cn("rtc-foot", isTouch && "hidden")}>
          <span>
            <b className="text-[#45e0e6]">A/D</b> o flechas mover · <b className="text-[#45e0e6]">ESPACIO</b> saltar ·{" "}
            <b className="text-[#45e0e6]">R</b> reiniciar · <b className="text-[#45e0e6]">ESC</b> pausa ·{" "}
            <b className="text-[#45e0e6]">M</b> sonido
          </span>
          <Btn onClick={() => actions.resetProgress()} variant="ghost" className="!px-2 !py-1 !text-[9px]">
            Borrar progreso
          </Btn>
        </footer>
      </div>
    </div>
  );
}

function TouchBtn({
  children,
  onDown,
  label,
  big,
  small,
}: {
  children: React.ReactNode;
  onDown: (v: boolean) => void;
  label: string;
  big?: boolean;
  small?: boolean;
}) {
  const [active, setActive] = useState(false);
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setActive(true);
    audio.unlock();
    onDown(true);
  };
  const up = (e: React.PointerEvent) => {
    e.preventDefault();
    setActive(false);
    onDown(false);
  };
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={down}
      onPointerUp={up}
      onPointerCancel={up}
      onPointerLeave={up}
      onContextMenu={(e) => e.preventDefault()}
      className={cn("rtc-touch", big && "rtc-touch-big", small && "rtc-touch-small", active && "rtc-touch-active")}
    >
      {children}
    </button>
  );
}
