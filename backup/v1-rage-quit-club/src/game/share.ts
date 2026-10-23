/**
 * share.ts — tarjeta de resultados compartible.
 * Web Share API si está disponible, portapapeles como alternativa y
 * texto visible como último recurso. Nunca lanza.
 */

import { SHARE_URL } from "./config";

export type ShareData = {
  level: number;
  levelName: string;
  time: number;
  deaths: number;
  score: number;
  totalDeaths: number;
  finished: boolean;
};

export function fmtTime(t: number) {
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

function quip(d: ShareData) {
  if (d.finished) return "Terminé el club. La física me debe una disculpa.";
  if (d.deaths === 0) return "Cero muertes. Nadie me va a creer.";
  if (d.deaths < 5) return "Pocas muertes. Estoy aprendiendo, más o menos.";
  if (d.deaths < 15) return "Las muertes ya son parte de mi rutina.";
  return "Sigo sin aprender y me encanta.";
}

export function buildShareText(d: ShareData) {
  const where = d.finished
    ? `Terminé los 10 niveles de Rage Quit Club`
    : `Llegué al nivel ${d.level} (${d.levelName}) de Rage Quit Club`;
  return [
    where,
    `${fmtTime(d.time)} · ${d.deaths} ${d.deaths === 1 ? "muerte" : "muertes"} · ${d.score} pts`,
    quip(d),
    `¿Podés hacerlo mejor? ${SHARE_URL}`,
  ].join("\n");
}

export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* seguimos con el fallback */
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export async function shareResult(d: ShareData): Promise<"shared" | "copied" | "manual"> {
  const text = buildShareText(d);
  const nav = navigator as Navigator & { share?: (data: { title?: string; text?: string; url?: string }) => Promise<void> };
  if (nav.share) {
    try {
      await nav.share({ title: "Rage Quit Club", text, url: SHARE_URL });
      return "shared";
    } catch {
      /* el usuario canceló o falló: probamos portapapeles */
    }
  }
  const ok = await copyText(text);
  return ok ? "copied" : "manual";
}
