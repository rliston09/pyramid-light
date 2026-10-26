import { useEffect, useRef, useState } from "react";
import { type Analysis, READOUT_COPY } from "@/game/geometry";
import { analysisToVisual, drawCross } from "@/game/crossCanvas";

export function CrossGlass({
  analysis,
  lockT,
  className,
}: {
  analysis: Analysis;
  lockT: number;
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(0);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setDark(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const next = Math.floor(Math.min(rect.width, rect.height));
      setSize(next > 16 ? next : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size < 16) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawCross(ctx, size, analysisToVisual(analysis), lockT, dark);
  }, [analysis, lockT, size, dark]);

  return (
    <div
      ref={wrapRef}
      className={
        className ?? "flex min-h-0 w-full flex-1 items-center justify-center overflow-hidden px-2"
      }
    >
      <canvas ref={canvasRef} role="img" aria-label={READOUT_COPY[analysis.readout]} />
    </div>
  );
}
