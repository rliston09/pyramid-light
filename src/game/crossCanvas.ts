import { type Analysis, headingToCanvas } from "./geometry";

const INK = "#d7e6ff";
const RED = "#ff2d55";
const BLUE = "#3ec6ff";
const GREEN = "#3dff9a";
const PURPLE = "#d06bff";

export type Visual = {
  redAngle: number;
  blueAngle: number;
  redArm: number;
  blueArm: number;
  redAlpha: number;
  blueAlpha: number;
  redWidth: number;
  blueWidth: number;
  redReach: boolean;
  blueReach: boolean;
  gap: number;
  side: number;
  compass: boolean;
  mixed: boolean;
  seed: number;
};

function band(dist: number) {
  if (dist <= 3) return 0;
  if (dist <= 7) return 1;
  if (dist <= 12) return 2;
  return 3;
}

export function analysisToVisual(a: Analysis): Visual {
  const arms = [0.34, 0.5, 0.7, 0.9];
  const widths = [7.5, 5.2, 3.3, 1.9];
  const alphas = [0.95, 0.78, 0.55, 0.34];
  const rb = band(a.redToCross);
  const bb = band(a.blueToCross);
  let gap = 0;
  if (a.separation >= 0.75) {
    if (a.separation < 2) gap = 24;
    else if (a.separation < 4) gap = 48;
    else if (a.separation < 8) gap = 74;
    else gap = 98;
  }
  return {
    redAngle: a.redAngle,
    blueAngle: a.blueAngle,
    redArm: arms[rb] ?? 0.9,
    blueArm: arms[bb] ?? 0.9,
    redAlpha: alphas[rb] ?? 0.34,
    blueAlpha: alphas[bb] ?? 0.34,
    redWidth: widths[rb] ?? 1.9,
    blueWidth: widths[bb] ?? 1.9,
    redReach: a.redReach,
    blueReach: a.blueReach,
    gap,
    side: a.side === 0 ? 1 : a.side,
    compass: a.compass,
    mixed: a.mixed,
    seed:
      a.red.x * 17 +
      a.red.y * 31 +
      a.red.z * 11 +
      a.blue.x * 13 +
      a.blue.y * 7 +
      a.blue.z * 3 +
      a.red.heading * 5 +
      a.blue.heading * 9 +
      a.red.pitch * 19 +
      a.blue.pitch * 23,
  };
}

function chalk(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
  alpha: number,
  _seed: number,
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.shadowColor = color;
  ctx.strokeStyle = color;
  ctx.globalAlpha = alpha * 0.4;
  ctx.shadowBlur = width * 2.4;
  ctx.lineWidth = width * 2.6;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.globalAlpha = alpha;
  ctx.shadowBlur = width * 0.8;
  ctx.strokeStyle = "#f4fbff";
  ctx.lineWidth = Math.max(1.25, width * 0.28);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function strokeSeg(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
  alpha: number,
  seed: number,
  dashed: boolean,
) {
  if (Math.hypot(x2 - x1, y2 - y1) < 1) return;
  if (!dashed) {
    chalk(ctx, x1, y1, x2, y2, color, width, alpha, seed);
    return;
  }
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = width * 1.6;
  ctx.globalAlpha = alpha * 0.9;
  ctx.lineWidth = Math.max(1.4, width * 0.7);
  ctx.lineCap = "round";
  ctx.setLineDash([width * 1.1, width * 1.5]);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function arrow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
  color: string,
  alpha: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size, 0);
  ctx.lineTo(-size * 0.75, size * 0.55);
  ctx.lineTo(-size * 0.28, 0);
  ctx.lineTo(-size * 0.75, -size * 0.55);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBeam(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  angle: number,
  arm: number,
  width: number,
  alpha: number,
  reach: boolean,
  color: string,
  seed: number,
  R: number,
  k: number,
) {
  const fx = Math.cos(angle);
  const fy = Math.sin(angle);
  const reachLen = arm * R;
  const back = reachLen * 0.82;
  const hole = reach ? 0 : 12 * k;
  const pt = (d: number) => [cx + fx * d, cy + fy * d] as const;

  const paint = (a: number, b: number, salt: number) => {
    if (b - a < 2) return;
    const [x1, y1] = pt(a);
    const [x2, y2] = pt(b);
    strokeSeg(ctx, x1, y1, x2, y2, color, width * k, alpha, seed + salt, !reach);
  };

  if (hole > 0) {
    paint(-back, -hole, 1);
    paint(hole, reachLen, 2);
  } else {
    paint(-back, reachLen, 1);
  }

  const [ax, ay] = pt(Math.max(hole + 4 * k, reachLen - 2 * k));
  arrow(ctx, ax, ay, angle, 6.5 * k, color, Math.min(1, alpha + 0.05));
}

function drawCheck(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, p: number) {
  const x1 = cx - s * 0.38;
  const y1 = cy + s * 0.02;
  const x2 = cx - s * 0.08;
  const y2 = cy + s * 0.32;
  const x3 = cx + s * 0.46;
  const y3 = cy - s * 0.36;
  const len1 = Math.hypot(x2 - x1, y2 - y1);
  const len2 = Math.hypot(x3 - x2, y3 - y2);
  const d = Math.max(0, Math.min(1, p)) * (len1 + len2);
  ctx.save();
  ctx.strokeStyle = GREEN;
  ctx.lineWidth = Math.max(3, s * 0.16);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.globalAlpha = 0.95;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  if (d <= len1) {
    const t = len1 === 0 ? 0 : d / len1;
    ctx.lineTo(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
  } else {
    ctx.lineTo(x2, y2);
    const t = len2 === 0 ? 1 : (d - len1) / len2;
    ctx.lineTo(x2 + (x3 - x2) * t, y2 + (y3 - y2) * t);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawCross(
  ctx: CanvasRenderingContext2D,
  size: number,
  v: Visual,
  lockT: number,
  dark = true,
) {
  const cx = size / 2;
  const cy = size / 2;
  const R = size * 0.33;
  const k = R / 140;
  const ink = dark ? INK : "#243044";

  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = dark ? "#05060a" : "#ffffff";
  ctx.fillRect(0, 0, size, size);

  const vignette = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.35);
  vignette.addColorStop(0, dark ? "#141824" : "#f7f9fb");
  vignette.addColorStop(1, dark ? "#05060a" : "#e7edf3");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);

  ctx.save();
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.25;
  ctx.globalAlpha = 0.28;
  const box = R * 1.12;
  const tick = R * 0.16;
  ctx.beginPath();
  for (const [sx, sy] of [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const) {
    const x = cx + sx * box;
    const y = cy + sy * box;
    ctx.moveTo(x, y + sy * -tick);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * -tick, y);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.22;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.1;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  const names = ["N", "E", "S", "W"];
  ctx.save();
  ctx.fillStyle = ink;
  ctx.font = `500 ${Math.max(11, Math.round(12 * k))}px "IBM Plex Mono", ui-monospace, monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let i = 0; i < 8; i++) {
    const a = v.compass ? headingToCanvas(i) : -Math.PI / 2 + i * (Math.PI / 4);
    const inner = i % 2 === 0 ? R - Math.max(8, 11 * k) : R - Math.max(5, 6 * k);
    ctx.strokeStyle = ink;
    ctx.globalAlpha = i % 2 === 0 ? 0.45 : 0.22;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
    ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
    ctx.stroke();
    if (i % 2 === 0 && v.compass) {
      const name = names[i / 2] ?? "";
      const labelR = R + Math.max(14, 16 * k);
      ctx.globalAlpha = 0.55;
      ctx.fillText(name, cx + Math.cos(a) * labelR, cy + Math.sin(a) * labelR);
    }
  }
  if (!v.compass) {
    const labelR = R + Math.max(14, 16 * k);
    ctx.globalAlpha = 0.6;
    ctx.fillText("U", cx, cy - labelR);
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.98, 0, Math.PI * 2);
  ctx.clip();

  if (lockT < 0.15) {
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.28;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 7 * k, cy);
    ctx.lineTo(cx + 7 * k, cy);
    ctx.moveTo(cx, cy - 7 * k);
    ctx.lineTo(cx, cy + 7 * k);
    ctx.stroke();
  }

  const shift = v.mixed ? 0 : (v.gap * k) / 2;
  const perp = v.redAngle + Math.PI / 2;
  const sx = Math.cos(perp) * shift * v.side;
  const sy = Math.sin(perp) * shift * v.side;
  const purple = v.mixed && lockT <= 0;

  if (purple) {
    const mid =
      v.redAngle +
      Math.atan2(Math.sin(v.blueAngle - v.redAngle), Math.cos(v.blueAngle - v.redAngle)) / 2;
    drawBeam(ctx, cx, cy, mid, 0.42, 9, 0.98, true, PURPLE, v.seed, R, k);
  } else {
    ctx.save();
    ctx.translate(-sx, -sy);
    drawBeam(ctx, cx, cy, v.redAngle, v.redArm, v.redWidth, v.redAlpha, v.redReach, RED, v.seed, R, k);
    ctx.restore();

    ctx.save();
    ctx.translate(sx, sy);
    drawBeam(
      ctx,
      cx,
      cy,
      v.blueAngle,
      v.blueArm,
      v.blueWidth,
      v.blueAlpha,
      v.blueReach,
      BLUE,
      v.seed + 90,
      R,
      k,
    );
    ctx.restore();
  }

  const hot = (v.redAlpha + v.blueAlpha) / 2;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * (lockT > 0 ? 0.42 : 0.24));
  if (lockT > 0) {
    glow.addColorStop(0, `rgba(61, 220, 132, ${0.55 * lockT})`);
    glow.addColorStop(0.45, `rgba(236, 234, 228, ${0.18 * lockT})`);
    glow.addColorStop(1, "rgba(0,0,0,0)");
  } else {
    glow.addColorStop(0, `rgba(236, 234, 228, ${0.28 * hot})`);
    glow.addColorStop(
      0.35,
      purple ? "rgba(200, 107, 255, 0.45)" : `rgba(255, 75, 62, ${0.16 * v.redAlpha})`,
    );
    glow.addColorStop(
      0.62,
      purple ? "rgba(200, 107, 255, 0.2)" : `rgba(76, 141, 255, ${0.14 * v.blueAlpha})`,
    );
    glow.addColorStop(1, "rgba(0,0,0,0)");
  }
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  if (lockT > 0) drawCheck(ctx, cx, cy, R * 0.52, lockT);

  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.strokeStyle = ink;
  ctx.globalAlpha = 0.38;
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.globalAlpha = 1;
}
