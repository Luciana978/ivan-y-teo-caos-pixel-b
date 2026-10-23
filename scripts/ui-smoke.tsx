/**
 * scripts/ui-smoke.tsx — prueba de humo de la UI (sólo desarrollo). npm run test:ui
 * Renderiza las pantallas a HTML con react-dom/server: detecta excepciones de render y comprueba
 * textos clave. NO sustituye una prueba en navegador real (eventos, canvas, audio, táctil).
 */
import { renderToStaticMarkup } from "react-dom/server";
import { CompleteScreen, MenuScreen, PauseScreen } from "../src/ui/screens";
import type { SaveData } from "../src/game/storage";

let fails = 0;
const check = (name: string, ok: boolean) => {
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}`);
};
const noop = () => {};
const actions = { play: noop, resume: noop, restart: noop, retry: noop, next: noop, toMenu: noop, toggleMute: noop, resetProgress: noop };
const empty: SaveData = { v: 2, levels: {}, totalDeaths: 0, totalClears: 0, scores: [], muted: false };
const some: SaveData = {
  ...empty,
  levels: { "1": { cleared: true, bestTime: 12.3, bestDeaths: 1, bestScore: 4100, bestGems: 3 } },
  totalDeaths: 4,
  scores: [{ score: 4100, level: 1, levelName: "TUTORIAL SOSPECHOSO", time: 12.3, deaths: 1, date: 1 }],
};

const menu = renderToStaticMarkup(<MenuScreen save={empty} actions={actions} muted={false} />);
check("menú: muestra la marca nueva", menu.includes("IVÁN &amp; TEO") && menu.includes("CAOS PIXEL"));
check("menú: copy de T1 (sin 'mala leche')", menu.includes("trampas con humor") && !menu.toLowerCase().includes("mala leche"));
check("menú: botón JUGAR y aviso de que morir es parte del juego", menu.includes("Jugar") && menu.includes("muertes son parte del diseño"));
check("menú sin progreso no muestra 'nivel N' en JUGAR", !/Jugar\s*·\s*nivel/.test(menu));
const menu2 = renderToStaticMarkup(<MenuScreen save={some} actions={actions} muted={true} />);
check("menú con progreso: JUGAR apunta al nivel 2", /Jugar[^<]*nivel 2/.test(menu2));
check("menú: sonido off visible", menu2.includes("Sonido off"));

const pause = renderToStaticMarkup(<PauseScreen actions={actions} muted={false} levelName="EL SUELO MIENTE" />);
check("pausa: continuar, reiniciar y menú", pause.includes("Continuar") && pause.includes("Reiniciar") && pause.includes("Menú principal"));

const done = renderToStaticMarkup(
  <CompleteScreen levelId={3} levelName="X" time={31.5} deaths={4} gems={5} gemsTotal={8} score={2500} bestTime={30.1} newRecord={false} headline="SOBREVIVISTE" actions={actions} finished={false} totalDeaths={9} totalScore={5000} />,
);
check("resultados: tiempo, muertes, gemas y puntos", done.includes("0:31.50") && done.includes("5/8") && done.includes("2500"));
check("resultados: siguiente, repetir y menú", done.includes("Siguiente nivel") && done.includes("Repetir") && done.includes("Menú principal"));
check("resultados: compartir y copiar", done.includes("Compartir") && done.includes("Copiar texto"));
const fin = renderToStaticMarkup(
  <CompleteScreen levelId={10} levelName="X" time={31.5} deaths={0} gems={5} gemsTotal={8} score={9000} bestTime={31.5} newRecord={true} headline="CAOS COMPLETO. FELICIDADES." actions={actions} finished={true} totalDeaths={9} totalScore={50000} />,
);
check("final: 'CAOS PIXEL · COMPLETO', jugar de nuevo y récord", fin.includes("CAOS PIXEL · COMPLETO") && fin.includes("Jugar de nuevo") && fin.includes("Nuevo récord"));
check("ninguna pantalla contiene 'Rage Quit'", !(menu + pause + done + fin).toLowerCase().includes("rage quit"));

process.exit(fails ? 1 : 0);
