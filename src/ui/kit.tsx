/** Primitivas de UI retro compartidas por todas las pantallas. */

import { useEffect, useRef, type ReactNode } from "react";
import { drawCharacterPreview } from "@/game/renderer";
import { cn } from "@/utils/cn";

export function Btn({
  children,
  onClick,
  variant = "primary",
  className,
  ariaLabel,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "primary" | "ghost" | "danger" | "cyan";
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "rtc-btn select-none px-4 py-2 text-[11px] uppercase tracking-[0.18em] sm:text-xs",
        variant === "primary" && "rtc-btn-primary",
        variant === "cyan" && "rtc-btn-cyan",
        variant === "ghost" && "rtc-btn-ghost",
        variant === "danger" && "rtc-btn-danger",
        disabled && "cursor-not-allowed opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rtc-panel w-full max-w-[560px] px-5 py-5 sm:px-7 sm:py-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Logo({ small }: { small?: boolean }) {
  return (
    <div className="rtc-logo select-none text-center leading-[0.9]">
      <div className={cn("rtc-logo-line1", small ? "text-2xl sm:text-3xl" : "text-4xl sm:text-6xl")}>
        IVÁN &amp; TEO
      </div>
      <div className={cn("rtc-logo-line2", small ? "text-lg sm:text-xl" : "text-2xl sm:text-4xl")}>
        CAOS PIXEL
      </div>
    </div>
  );
}

/** Ilustración del personaje, dibujada con el mismo código del juego. */
export function CharacterBox({ size = 92, className }: { size?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let t = 0;
    let last = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!reduced) t += dt;
      ctx.imageSmoothingEnabled = false;
      drawCharacterPreview(ctx, cv.width, cv.height, t);
      if (reduced) cancelAnimationFrame(raf);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  return (
    <canvas
      ref={ref}
      width={size}
      height={size}
      aria-hidden="true"
      className={cn("rtc-pixel", className)}
      style={{ width: size, height: size }}
    />
  );
}

export function Stat({ label, value, accent }: { label: string; value: ReactNode; accent?: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-[0.2em] text-white/40">{label}</span>
      <span className={cn("text-sm font-bold sm:text-base", accent ?? "text-[#f4f0e8]")}>{value}</span>
    </div>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <span className="rtc-kbd">{children}</span>
  );
}
