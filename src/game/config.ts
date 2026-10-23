/**
 * config.ts — constantes centrales de IVÁN & TEO — CAOS PIXEL.
 * Todo lo tunable del juego vive acá: paleta, físicas, tiempos y recompensas.
 * Cambiar un valor acá no debe requerir tocar ningún otro módulo.
 */

export const TILE = 16; // px por tile
export const VIEW_W = 480; // resolución lógica interna (30 tiles)
export const VIEW_H = 240; // resolución lógica interna (15 tiles)
export const ROWS = 15; // filas de todos los niveles

/** Paleta retro (identidad visual única del juego). */
export const PAL = {
  bgTop: "#11111b",
  bgBottom: "#1b1b2f",
  surface: "#222238",
  surfaceLit: "#2f2f4a",
  surfaceEdge: "#45e0e6",
  violet: "#8b5cf6",
  cyan: "#45e0e6",
  danger: "#ff8a3d",
  death: "#ff4d6d",
  warm: "#f4f0e8",
  gold: "#ffd166",
  dark: "#0b0b12",
} as const;

/** Físicas (unidades px y segundos, simulación a paso fijo). */
export const PHYS = {
  step: 1 / 120, // paso fijo de simulación
  gravity: 1500,
  maxFall: 460,
  runAccel: 900, // aceleración en suelo
  airAccel: 700, // aceleración en el aire
  friction: 1100, // desaceleración sin input en suelo
  airDrag: 220, // desaceleración sin input en el aire
  maxSpeed: 150,
  jumpVel: 380, // ~3 tiles de altura
  jumpCut: 0.42, // recorte de salto al soltar el botón
  coyote: 0.09, // gracia para saltar tras dejar el borde
  buffer: 0.12, // buffer de salto antes de tocar el suelo
  apexBonus: 0.12, // segundos de "flotación" en el ápice
  maxGapTiles: 5, // referencia de diseño (documental)
} as const;

/** Ritmo del juego / muerte / reinicio. */
export const TIMING = {
  deathFreeze: 0.06, // hit-stop inicial
  deathDelay: 0.95, // espera antes del reinicio automático
  winDelay: 0.55, // espera antes de mostrar resultados
  shakeDecay: 6.5,
  maxDelta: 0.05, // clamp de delta por frame
} as const;

/** Trampas: todos los tiempos son deterministas. */
export const TRAP = {
  crumbleWarn: 0.22, // temblor antes de caer
  popWarn: 0.3, // telegrafía de pinchos ocultos
  popRange: 58, // px de proximidad horizontal
  popVertRange: 52, // px de proximidad vertical
  ambushWarn: 0.55, // piso "seguro" antes de volverse pinchos (permite cruzar 4 tiles)
  ghostWarn: 0.3, // pared fantasma antes de materializarse
  ghostRange: 76, // px de proximidad para la pared fantasma
  pistonWarn: 0.16, // proporción del ciclo usada como aviso
} as const;

/** Puntaje. */
export const SCORE = {
  gem: 150,
  clear: 1500,
  timeBonusPerSec: 30,
  timeBonusBase: 3000,
  deathPenalty: 100,
  flawless: 800,
  maxTableEntries: 8,
} as const;

/**
 * Identificador del guardado local. Versión de prueba "Iván & Teo": se aísla bajo una clave
 * nueva (`ivan-teo-caos-pixel.save.v2`). Los datos del MVP anterior (`rage-quit-club.save.v2`)
 * NO se leen ni se borran.
 */
export const GAME_ID = "ivan-teo-caos-pixel";
export const GAME_TITLE = "Iván & Teo — Caos Pixel";
/**
 * URL pública usada al compartir. Sólo existe si se define VITE_GAME_URL al compilar.
 * Sin ella, el texto compartido NO incluye ningún enlace (no se promociona localhost).
 */
export const SHARE_URL: string =
  ((import.meta as unknown as { env?: Record<string, string | undefined> }).env?.VITE_GAME_URL ?? "").trim();
