import { useEffect, useRef, useState, type PointerEvent } from "react";
import { type MoveBox, type Pyramid, type Side, type Space, beamDir } from "@/game/geometry";

const RED = "#ff2d55";
const BLUE = "#3ec6ff";
const PURPLE = "#d06bff";

type Pt = { x: number; y: number; depth: number };
type V = { x: number; y: number; z: number };

function add(a: V, b: V): V {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}
function scale(a: V, k: number): V {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}
function cross(a: V, b: V): V {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}
function norm(a: V): V {
  const l = Math.hypot(a.x, a.y, a.z) || 1;
  return scale(a, 1 / l);
}

function frame(dir: V) {
  const hint = Math.abs(dir.z) < 0.85 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  const right = norm(cross(dir, hint));
  const side = norm(cross(dir, right));
  return { right, side };
}

function ticks(a: number, b: number, step: number) {
  const out: number[] = [];
  for (let v = a; v < b; v += step) out.push(v);
  if (out[out.length - 1] !== b) out.push(b);
  return out;
}

function drawMoveBox(
  ctx: CanvasRenderingContext2D,
  box: MoveBox,
  color: string,
  w: number,
  h: number,
  flat: boolean,
  view: View,
) {
  const nx = box.x1 - box.x0 + 1;
  const ny = box.y1 - box.y0 + 1;
  const nz = box.z1 - box.z0 + 1;
  let step = 1;
  while (Math.ceil(nx / step) * Math.ceil(ny / step) * Math.ceil(nz / step) > 140) step += 1;
  const xs = ticks(box.x0, box.x1, step);
  const ys = ticks(box.y0, box.y1, step);
  const zs = flat ? [0] : ticks(box.z0, box.z1, step);
  const cells: Array<{ depth: number; faces: Pt[][] }> = [];
  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        const p = (dx: number, dy: number, dz: number) =>
          project(x + dx, y + dy, flat ? 0 : z + dz, w, h, flat, view);
        const o = p(0.16, 0.16, 0.16);
        const ax = p(0.84, 0.16, 0.16);
        const ay = p(0.16, 0.84, 0.16);
        const az = p(0.16, 0.16, 0.84);
        const axy = p(0.84, 0.84, 0.16);
        const axz = p(0.84, 0.16, 0.84);
        const ayz = p(0.16, 0.84, 0.84);
        cells.push({
          depth: o.depth,
          faces: [
            [o, ax, axy, ay],
            [o, ay, ayz, az],
            [o, ax, axz, az],
          ],
        });
      }
    }
  }
  cells.sort((a, b) => a.depth - b.depth);
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.8;
  for (const cell of cells) {
    cell.faces.forEach((face, i) => {
      ctx.globalAlpha = 0.28 + i * 0.14;
      ctx.beginPath();
      face.forEach((pt, n) => (n === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
  }
  ctx.restore();
}

function laser(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, color: string) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.28;
  ctx.shadowBlur = 16;
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.globalAlpha = 0.95;
  ctx.shadowBlur = 8;
  ctx.strokeStyle = "#f7fbff";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setDark(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);
  return dark;
}

type View = { yaw: number; pitch: number; zoom: number };

function project(x: number, y: number, z: number, w: number, h: number, flat: boolean, view: View): Pt {
  const gx = x - 9.5;
  const gy = y - 9.5;
  const gz = flat ? 0 : z - 9.5;
  const yaw = view.yaw;
  const pitch = flat ? 1.15 : view.pitch;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const x1 = gx * cy - gy * sy;
  const y1 = gx * sy + gy * cy;
  const y2 = y1 * cp - gz * sp;
  const z2 = y1 * sp + gz * cp;
  const s = Math.min(w, h) * (flat ? 0.038 : 0.032) * view.zoom;
  return { x: w / 2 + x1 * s, y: h / 2 - z2 * s, depth: y2 };
}

function drawPyramid(
  ctx: CanvasRenderingContext2D,
  p: Pyramid,
  color: string,
  w: number,
  h: number,
  flat: boolean,
  ghost: boolean,
  view: View,
  beamOnly = false,
  beamColor?: string,
  bodyOnly = false,
) {
  const dir = beamDir(p);
  const { right, side } = frame(dir);
  const c = { x: p.x + 0.5, y: p.y + 0.5, z: flat ? 0.5 : p.z + 0.5 };
  const apex = add(c, scale(dir, 1.25));
  const base = add(c, scale(dir, -0.35));
  const span = 0.72;
  const corners = [
    add(base, add(scale(right, span), scale(side, span))),
    add(base, add(scale(right, -span), scale(side, span))),
    add(base, add(scale(right, -span), scale(side, -span))),
    add(base, add(scale(right, span), scale(side, -span))),
  ];
  const at = (v: V) => project(v.x, v.y, flat ? 0 : v.z, w, h, flat, view);
  const tip = at(apex);
  const ring = corners.map(at);

  if (!beamOnly) {
    ctx.save();
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = color;
    ctx.shadowColor = color;
    ctx.shadowBlur = ghost ? 0 : 12;
    ctx.globalAlpha = ghost ? 0.55 : 1;
    ctx.lineWidth = ghost ? 1.1 : 1.7;
    if (ghost) ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ring.forEach((pt, i) => (i === 0 ? ctx.moveTo(pt.x, pt.y) : ctx.lineTo(pt.x, pt.y)));
    ctx.closePath();
    ctx.stroke();
    for (const pt of ring) {
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(tip.x, tip.y);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (!ghost && !bodyOnly) {
    const far = at(add(apex, scale(dir, 6.5)));
    laser(ctx, tip.x, tip.y, far.x, far.y, beamColor ?? color);
    if (!beamOnly) {
      ctx.save();
      ctx.fillStyle = "#f7fbff";
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 2.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export function CubeStage({
  red,
  blue,
  turn,
  otherBeam,
  mixed,
  finale,
  space,
  ghost,
  redBox,
  blueBox,
}: {
  red: Pyramid;
  blue: Pyramid;
  turn: Side;
  otherBeam: boolean;
  mixed: boolean;
  finale: boolean;
  space: Space;
  ghost?: Pyramid | null;
  redBox: MoveBox | null;
  blueBox: MoveBox | null;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ yaw: 0.62, pitch: 0.62, zoom: 1 });
  const dark = useDark();
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ id: number; x: number; y: number; yaw: number; pitch: number } | null>(null);
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2) {
      drag.current = null;
      const pts = [...pointers.current.values()];
      pinch.current = {
        dist: Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) || 1,
        zoom: viewRef.current.zoom,
      };
      return;
    }
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      yaw: viewRef.current.yaw,
      pitch: viewRef.current.pitch,
    };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size >= 2 && pinch.current) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y) || 1;
      const zoom = Math.min(2.4, Math.max(0.65, pinch.current.zoom * (dist / pinch.current.dist)));
      setView((v) => ({ ...v, zoom }));
      return;
    }
    const held = drag.current;
    if (!held || held.id !== e.pointerId) return;
    const yaw = held.yaw + (e.clientX - held.x) * 0.01;
    const pitch = Math.min(1.4, Math.max(0.15, held.pitch - (e.clientY - held.y) * 0.008));
    setView((v) => ({ ...v, yaw, pitch }));
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    pointers.current.delete(e.pointerId);
    if (drag.current?.id === e.pointerId) drag.current = null;
    if (pointers.current.size < 2) pinch.current = null;
    if (pointers.current.size === 1) {
      const entry = [...pointers.current.entries()][0];
      if (!entry) return;
      const [id, pt] = entry;
      drag.current = { id, x: pt.x, y: pt.y, yaw: viewRef.current.yaw, pitch: viewRef.current.pitch };
    }
  }

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setSize({ w: Math.floor(r.width), h: Math.floor(r.height) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const { w, h } = size;
    if (!canvas || w < 20 || h < 20) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const glow = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h * 0.45, Math.max(w, h) * 0.72);
    if (dark) {
      glow.addColorStop(0, "#12161f");
      glow.addColorStop(1, "#05060a");
    } else {
      glow.addColorStop(0, "#ffffff");
      glow.addColorStop(1, "#e7edf3");
    }
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);

    const flat = space === "flat";
    const edges: Array<[[number, number, number], [number, number, number]]> = [];
    if (flat) {
      edges.push(
        [[0, 0, 0], [20, 0, 0]],
        [[20, 0, 0], [20, 20, 0]],
        [[20, 20, 0], [0, 20, 0]],
        [[0, 20, 0], [0, 0, 0]],
      );
    } else {
      const pts: Array<[number, number, number]> = [
        [0, 0, 0],
        [20, 0, 0],
        [20, 20, 0],
        [0, 20, 0],
        [0, 0, 20],
        [20, 0, 20],
        [20, 20, 20],
        [0, 20, 20],
      ];
      const pairs = [
        [0, 1],
        [1, 2],
        [2, 3],
        [3, 0],
        [4, 5],
        [5, 6],
        [6, 7],
        [7, 4],
        [0, 4],
        [1, 5],
        [2, 6],
        [3, 7],
      ];
      for (const [a, b] of pairs) edges.push([pts[a]!, pts[b]!]);
    }

    const drawn = edges
      .map(([a, b]) => {
        const pa = project(a[0], a[1], a[2], w, h, flat, view);
        const pb = project(b[0], b[1], b[2], w, h, flat, view);
        return { pa, pb, depth: (pa.depth + pb.depth) / 2 };
      })
      .sort((a, b) => a.depth - b.depth);

    const zoom = Math.max(0.65, view.zoom);
    const gain = 0.7 + (zoom - 0.65) * 0.85;
    const edge = dark ? "#7ef6ff" : "#0b6480";
    ctx.lineCap = "round";
    for (const e of drawn) {
      ctx.strokeStyle = edge;
      ctx.globalAlpha = Math.min(0.95, (dark ? 0.2 : 0.28) * gain);
      ctx.lineWidth = (dark ? 2.2 : 2.6) * gain;
      ctx.beginPath();
      ctx.moveTo(e.pa.x, e.pa.y);
      ctx.lineTo(e.pb.x, e.pb.y);
      ctx.stroke();
      ctx.globalAlpha = Math.min(1, (dark ? 0.62 : 0.9) * Math.min(gain, 1.35));
      ctx.lineWidth = Math.max(1.15, (dark ? 1.15 : 1.4) * gain);
      ctx.beginPath();
      ctx.moveTo(e.pa.x, e.pa.y);
      ctx.lineTo(e.pb.x, e.pb.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    if (turn === "red" && redBox) drawMoveBox(ctx, redBox, RED, w, h, flat, view);
    if (turn === "blue" && blueBox) drawMoveBox(ctx, blueBox, BLUE, w, h, flat, view);

    const self = turn === "red" ? red : blue;
    const other = turn === "red" ? blue : red;
    const mine = turn === "red" ? RED : BLUE;
    const theirs = turn === "red" ? BLUE : RED;
    if (finale) {
      const a = project(red.x + 0.5, red.y + 0.5, flat ? 0 : red.z + 0.5, w, h, flat, view);
      const b = project(blue.x + 0.5, blue.y + 0.5, flat ? 0 : blue.z + 0.5, w, h, flat, view);
      laser(ctx, a.x, a.y, b.x, b.y, PURPLE);
      drawPyramid(ctx, red, PURPLE, w, h, flat, false, view);
      drawPyramid(ctx, blue, PURPLE, w, h, flat, false, view);
    } else {
      const pending = ghost ?? self;
      const moved = pending.x !== self.x || pending.y !== self.y || pending.z !== self.z;
      const aiming = pending.heading !== self.heading || pending.pitch !== self.pitch;
      drawPyramid(ctx, self, mine, w, h, flat, false, view, false, undefined, true);
      drawPyramid(
        ctx,
        moved ? pending : { ...self, heading: pending.heading, pitch: pending.pitch },
        mine,
        w,
        h,
        flat,
        false,
        view,
        true,
        !aiming && !moved && mixed ? PURPLE : undefined,
      );
      if (moved) drawPyramid(ctx, pending, mine, w, h, flat, true, view, false, undefined, true);
      if (otherBeam) drawPyramid(ctx, other, theirs, w, h, flat, false, view, true, mixed ? PURPLE : undefined);
    }
  }, [red, blue, turn, otherBeam, mixed, finale, space, size, ghost, redBox, blueBox, view, dark]);

  const who = turn === "red" ? "Red" : "Blue";
  return (
    <div
      ref={wrapRef}
      className="absolute inset-0 touch-none overflow-hidden"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <canvas ref={canvasRef} className="block h-full w-full" role="img" aria-label={finale ? "Both pyramids, lights mixed" : otherBeam ? `${who}'s pyramid and the other beam` : `${who}'s pyramid in the cube`} />
      <p className="pointer-events-none absolute inset-x-0 bottom-1 text-center font-mono text-[10px] tracking-wide text-muted">
        {finale
          ? "Both pyramids · drag to turn"
          : otherBeam
            ? `${who}'s pyramid · other beam · drag to turn`
            : `${who}'s pyramid · drag to turn`}
      </p>
    </div>
  );
}
