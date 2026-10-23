/** screens.tsx — todas las pantallas del juego (menú, niveles, récords, pausa, resultados). */

import { useState } from "react";
import { LEVELS } from "@/game/levels";

const DIFFICULTY = ["FÁCIL", "FÁCIL", "FÁCIL", "MEDIO", "MEDIO", "MEDIO", "DIFÍCIL", "DIFÍCIL", "BRUTAL", "BRUTAL"];
import { SCORE } from "@/game/config";
import { storage, type SaveData } from "@/game/storage";
import type { ShareData } from "@/game/share";
import { buildShareText, copyText, fmtTime, shareResult } from "@/game/share";
import { Btn, CharacterBox, Kbd, Logo, Panel, Stat } from "./kit";
import { cn } from "@/utils/cn";

export type Actions = {
  play: (index: number) => void;
  resume: () => void;
  restart: () => void;
  next: () => void;
  toMenu: () => void;
  toggleMute: () => void;
  resetProgress: () => void;
};

/* ------------------------------- iconos ------------------------------- */

const IconLock = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
    <rect x="2" y="5" width="8" height="6" fill="currentColor" />
    <path d="M4 5V3.5a2 2 0 014 0V5" stroke="currentColor" strokeWidth="1.4" fill="none" />
  </svg>
);
const IconCheck = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
    <path d="M2 6.5l2.5 2.5L10 3.5" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="square" />
  </svg>
);
const IconClock = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
    <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" fill="none" />
    <path d="M6 3.5V6l2 1.2" stroke="currentColor" strokeWidth="1.3" fill="none" />
  </svg>
);
const IconSkull = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
    <path d="M2.5 5.2A3.5 3.5 0 019.5 5.2v2.3H8.3v1.4H3.7V7.5H2.5z" fill="currentColor" />
    <circle cx="4.6" cy="5.6" r="0.85" fill="#11111b" />
    <circle cx="7.4" cy="5.6" r="0.85" fill="#11111b" />
  </svg>
);
const IconGem = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true">
    <path d="M6 1l4 4-4 6-4-6z" fill="currentColor" />
  </svg>
);
const IconSound = ({ muted }: { muted: boolean }) => (
  <svg viewBox="0 0 14 14" className="h-3.5 w-3.5" aria-hidden="true">
    <path d="M2 5h2.5L8 2v10L4.5 9H2z" fill="currentColor" />
    {muted ? (
      <path d="M10 5l3 4M13 5l-3 4" stroke="currentColor" strokeWidth="1.4" />
    ) : (
      <path d="M10.5 4.5a4 4 0 010 5" stroke="currentColor" strokeWidth="1.4" fill="none" />
    )}
  </svg>
);

/* -------------------------------- menú -------------------------------- */

export function MenuScreen({
  save,
  actions,
  muted,
}: {
  save: SaveData;
  actions: Actions;
  muted: boolean;
}) {
  const [tab, setTab] = useState<"none" | "levels" | "records" | "howto">("none");
  const nextIndex = Math.max(0, Math.min(LEVELS.length - 1, storage.highestUnlocked(save, LEVELS.length) - 1));
  const cleared = LEVELS.filter((l) => storage.level(l.id, save).cleared).length;
  const total = LEVELS.length;

  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto px-3 py-5">
      <div className="flex items-end justify-center gap-3 sm:gap-6">
        <CharacterBox size={86} className="hidden sm:block" />
        <div className="flex flex-col items-center gap-1">
          <Logo />
          <p className="max-w-[38ch] text-center text-[10px] uppercase tracking-[0.22em] text-[#45e0e6]/80">
            Plataformas de precisión · trampas con humor
          </p>
        </div>
        <CharacterBox size={86} className="sm:hidden" />
      </div>

      <Panel className="flex flex-col items-center gap-4">
        <p className="text-center text-[11px] leading-relaxed text-white/60">
          «Cada nivel parece fácil hasta que algo no funciona como esperabas.»
          <br />
          <span className="text-[#ff8a3d]">Las muertes son parte del diseño.</span>
        </p>

        {tab === "none" && (
          <div className="flex w-full flex-col items-stretch gap-2">
            <Btn onClick={() => actions.play(nextIndex)} variant="primary" className="py-3 text-sm">
              ▸ Jugar {cleared > 0 ? `· nivel ${nextIndex + 1}` : ""}
            </Btn>
            <div className="grid grid-cols-3 gap-2">
              <Btn onClick={() => setTab("levels")} variant="cyan">
                Niveles
              </Btn>
              <Btn onClick={() => setTab("records")} variant="cyan">
                Récords
              </Btn>
              <Btn onClick={() => setTab("howto")} variant="cyan">
                Controles
              </Btn>
            </div>
          </div>
        )}

        {tab === "levels" && <LevelGrid save={save} actions={actions} onClose={() => setTab("none")} />}
        {tab === "records" && <Records save={save} onClose={() => setTab("none")} onReset={actions.resetProgress} />}
        {tab === "howto" && <HowTo onClose={() => setTab("none")} />}

        <div className="flex w-full items-center justify-between gap-2 border-t border-white/10 pt-3">
          <span className="text-[9px] uppercase tracking-[0.2em] text-white/35">
            {cleared}/{total} niveles · {save.totalDeaths} muertes totales
          </span>
          <Btn onClick={actions.toggleMute} variant="ghost" ariaLabel={muted ? "Activar sonido" : "Silenciar"}>
            <span className="flex items-center gap-2">
              <IconSound muted={muted} /> {muted ? "Sonido off" : "Sonido on"}
            </span>
          </Btn>
        </div>
      </Panel>
    </div>
  );
}

/* ---------------------------- selector niveles ---------------------------- */

function LevelGrid({
  save,
  actions,
  onClose,
}: {
  save: SaveData;
  actions: Actions;
  onClose: () => void;
}) {
  return (
    <div className="w-full">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {LEVELS.map((def, i) => {
          const rec = storage.level(def.id, save);
          const unlocked = storage.isUnlocked(def.id, save);
          return (
            <button
              key={def.id}
              type="button"
              disabled={!unlocked}
              onClick={() => actions.play(i)}
              className={cn(
                "rtc-lv flex flex-col gap-1 p-2 text-left",
                rec.cleared && "rtc-lv-cleared",
                !unlocked && "cursor-not-allowed opacity-45",
              )}
            >
              <span className="flex items-center justify-between text-[10px] tracking-[0.2em] text-white/50">
                <span>
                  N{def.id}
                  <span
                    className={cn(
                      "ml-1 text-[7px] tracking-[0.12em]",
                      i >= 8 ? "text-[#ff4d6d]" : i >= 6 ? "text-[#ff8a3d]" : "text-white/30",
                    )}
                  >
                    {DIFFICULTY[i] ?? ""}
                  </span>
                </span>
                {rec.cleared ? (
                  <span className="text-[#45e0e6]">
                    <IconCheck />
                  </span>
                ) : unlocked ? (
                  <span className="text-[#ff8a3d]">!</span>
                ) : (
                  <IconLock />
                )}
              </span>
              <span className="text-[10px] font-bold uppercase leading-tight tracking-wide text-[#f4f0e8]">
                {def.name}
              </span>
              <span className="flex items-center gap-2 text-[9px] text-white/45">
                {rec.bestTime !== null ? (
                  <>
                    <IconClock /> {fmtTime(rec.bestTime)}
                  </>
                ) : (
                  <span>— sin marca —</span>
                )}
              </span>
              {rec.cleared && (
                <span className="flex items-center gap-2 text-[9px] text-white/45">
                  <IconSkull /> {rec.bestDeaths ?? 0} · <IconGem /> {rec.bestGems}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-3 flex justify-center">
        <Btn onClick={onClose} variant="ghost">
          Volver
        </Btn>
      </div>
    </div>
  );
}

/* -------------------------------- récords -------------------------------- */

function Records({
  save,
  onClose,
  onReset,
}: {
  save: SaveData;
  onClose: () => void;
  onReset: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const best = save.scores.slice(0, SCORE.maxTableEntries);
  const totalScore = LEVELS.reduce((a, l) => a + storage.level(l.id, save).bestScore, 0);
  return (
    <div className="w-full">
      <div className="mb-2 grid grid-cols-3 gap-2">
        <Stat label="Puntaje total" value={totalScore} accent="text-[#ffd166]" />
        <Stat label="Muertes" value={save.totalDeaths} accent="text-[#ff4d6d]" />
        <Stat label="Niveles" value={`${LEVELS.filter((l) => storage.level(l.id, save).cleared).length}/${LEVELS.length}`} />
      </div>
      <div className="rtc-table">
        <div className="rtc-tr rtc-tr-head">
          <span>#</span>
          <span>Nivel</span>
          <span className="text-right">Puntos</span>
          <span className="text-right">Tiempo</span>
          <span className="text-right">☠</span>
        </div>
        {best.length === 0 && (
          <div className="rtc-tr">
            <span>—</span>
            <span className="col-span-4 text-white/40">Todavía no hay marcas. Andá a morir un poco.</span>
          </div>
        )}
        {best.map((s, i) => (
          <div key={`${s.date}-${i}`} className="rtc-tr">
            <span className="text-white/40">{i + 1}</span>
            <span className="truncate">
              N{s.level} {s.levelName}
            </span>
            <span className="text-right text-[#ffd166]">{s.score}</span>
            <span className="text-right">{fmtTime(s.time)}</span>
            <span className="text-right text-[#ff4d6d]">{s.deaths}</span>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <Btn onClick={onClose} variant="ghost">
          Volver
        </Btn>
        {confirm ? (
          <Btn
            onClick={() => {
              onReset();
              setConfirm(false);
            }}
            variant="danger"
          >
            Confirmar borrado
          </Btn>
        ) : (
          <Btn onClick={() => setConfirm(true)} variant="ghost">
            Borrar datos
          </Btn>
        )}
      </div>
    </div>
  );
}

/* ------------------------------- controles ------------------------------- */

function HowTo({ onClose }: { onClose: () => void }) {
  return (
    <div className="w-full text-[11px] leading-relaxed text-white/70">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <h4 className="mb-1 text-[10px] uppercase tracking-[0.2em] text-[#45e0e6]">Escritorio</h4>
          <ul className="space-y-1">
            <li>
              <Kbd>A</Kbd> <Kbd>D</Kbd> o flechas: mover
            </li>
            <li>
              <Kbd>Espacio</Kbd> <Kbd>W</Kbd> <Kbd>↑</Kbd>: saltar
            </li>
            <li>
              <Kbd>R</Kbd>: reiniciar nivel
            </li>
            <li>
              <Kbd>Esc</Kbd> o <Kbd>P</Kbd>: pausa
            </li>
            <li>
              <Kbd>M</Kbd>: silenciar
            </li>
          </ul>
        </div>
        <div>
          <h4 className="mb-1 text-[10px] uppercase tracking-[0.2em] text-[#45e0e6]">Trampas</h4>
          <ul className="space-y-1">
            <li>
              <span className="text-[#ff8a3d]">Naranja</span>: pinchos. Los ocultos tiemblan antes de brotar.
            </li>
            <li>
              <span className="text-[#8b5cf6]">Violeta rajado</span>: piso frágil, cae enseguida.
            </li>
            <li>
              <span className="text-[#8b5cf6]">Paredes</span>: algunas aparecen al acercarte.
            </li>
            <li>
              <span className="text-[#45e0e6]">Cian</span>: salida verdadera. Si parpadea, es trampa.
            </li>
          </ul>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-white/45">
        Toda trampa es reproducible: mismo movimiento, mismo resultado. Si morís, la próxima vez la ves venir.
      </p>
      <div className="mt-3 flex justify-center">
        <Btn onClick={onClose} variant="ghost">
          Volver
        </Btn>
      </div>
    </div>
  );
}

/* --------------------------------- pausa --------------------------------- */

export function PauseScreen({
  actions,
  muted,
  levelName,
}: {
  actions: Actions;
  muted: boolean;
  levelName: string;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-[#11111b]/80 px-3 backdrop-blur-[2px]">
      <Panel className="flex flex-col items-center gap-4">
        <h2 className="rtc-head text-2xl">PAUSA</h2>
        <p className="text-[10px] uppercase tracking-[0.2em] text-white/45">{levelName}</p>
        <div className="grid w-full grid-cols-2 gap-2">
          <Btn onClick={actions.resume} variant="primary" className="col-span-2 py-3">
            ▸ Continuar
          </Btn>
          <Btn onClick={actions.restart} variant="cyan">
            Reiniciar (R)
          </Btn>
          <Btn onClick={actions.toggleMute} variant="cyan">
            {muted ? "Sonido off" : "Sonido on"} (M)
          </Btn>
          <Btn onClick={actions.toMenu} variant="ghost" className="col-span-2">
            Menú principal
          </Btn>
        </div>
      </Panel>
    </div>
  );
}

/* ------------------------------- resultados ------------------------------- */

function ShareRow({ data }: { data: ShareData }) {
  const text = buildShareText(data);
  const [state, setState] = useState<"idle" | "shared" | "copied" | "manual">("idle");
  return (
    <div className="flex w-full flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        <Btn
          onClick={async () => {
            const r = await shareResult(data);
            setState(r);
          }}
          variant="cyan"
        >
          Compartir
        </Btn>
        <Btn
          onClick={async () => {
            const ok = await copyText(text);
            setState(ok ? "copied" : "manual");
          }}
          variant="ghost"
        >
          Copiar texto
        </Btn>
      </div>
      {state !== "idle" && (
        <p className="text-center text-[9px] uppercase tracking-[0.2em] text-[#45e0e6]">
          {state === "shared" && "Compartido"}
          {state === "copied" && "Texto copiado al portapapeles"}
          {state === "manual" && "Copiá manualmente el texto de abajo"}
        </p>
      )}
      {state === "manual" && (
        <textarea readOnly value={text} className="rtc-share-text" rows={4} onFocus={(e) => e.currentTarget.select()} />
      )}
    </div>
  );
}

export function CompleteScreen({
  levelId,
  levelName,
  time,
  deaths,
  gems,
  gemsTotal,
  score,
  bestTime,
  newRecord,
  headline,
  actions,
  finished,
  totalDeaths,
  totalScore,
}: {
  levelId: number;
  levelName: string;
  time: number;
  deaths: number;
  gems: number;
  gemsTotal: number;
  score: number;
  bestTime: number | null;
  newRecord: boolean;
  headline: string;
  actions: Actions;
  finished: boolean;
  totalDeaths: number;
  totalScore: number;
}) {
  const data: ShareData = { level: levelId, levelName, time, deaths, score, totalDeaths, finished };
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-y-auto bg-[#11111b]/85 px-3 py-6">
      <Panel className="flex flex-col items-center gap-4">
        <div className="flex flex-col items-center">
          <span className="text-[9px] uppercase tracking-[0.3em] text-[#45e0e6]">
            {finished ? "CAOS PIXEL · COMPLETO" : `NIVEL ${levelId} SUPERADO`}
          </span>
          <h2 className="rtc-head mt-1 text-center text-xl sm:text-2xl">{headline}</h2>
          <p className="text-[10px] uppercase tracking-[0.2em] text-white/40">{levelName}</p>
        </div>

        <div className="grid w-full grid-cols-4 gap-2 border-y border-white/10 py-3">
          <Stat label="Tiempo" value={fmtTime(time)} />
          <Stat label="Muertes" value={deaths} accent="text-[#ff4d6d]" />
          <Stat label="Gemas" value={`${gems}/${gemsTotal}`} accent="text-[#ffd166]" />
          <Stat label="Puntos" value={score} accent="text-[#ffd166]" />
        </div>

        <div className="flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[9px] uppercase tracking-[0.2em] text-white/45">
          {newRecord && <span className="text-[#45e0e6]">¡Nuevo récord personal!</span>}
          {bestTime !== null && <span>Mejor tiempo: {fmtTime(bestTime)}</span>}
          {deaths === 0 && <span className="text-[#ff8a3d]">Sin muertes: +{SCORE.flawless}</span>}
          {finished && <span>Puntaje total acumulado: {totalScore}</span>}
        </div>

        <ShareRow data={data} />

        <div className="grid w-full grid-cols-2 gap-2">
          {finished ? (
            <>
              <Btn onClick={() => actions.play(0)} variant="primary" className="py-3">
                ▸ Jugar de nuevo
              </Btn>
              <Btn onClick={actions.toMenu} variant="cyan" className="py-3">
                Menú
              </Btn>
            </>
          ) : (
            <>
              <Btn onClick={actions.next} variant="primary" className="py-3">
                ▸ Siguiente nivel
              </Btn>
              <Btn onClick={actions.restart} variant="cyan" className="py-3">
                Repetir
              </Btn>
              <Btn onClick={actions.toMenu} variant="ghost" className="col-span-2">
                Menú principal
              </Btn>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}

export { LevelGrid, Records, HowTo };
