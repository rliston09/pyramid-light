/** Grid and beam math for the flat board and the 20³ cube.
 *  Rendering only sees qualitative fields (angles, gap, readout) — never a map. */

export const GRID = 20;
export const ALIGN_DIST = 3;
export const MIX_DIST = 5;
export const MOVE_REACH = 15;

export type Space = "flat" | "cube";
export type Side = "red" | "blue";
export type Phase = "seek" | "near" | "mix" | "joined";

export type Pyramid = {
  x: number;
  y: number;
  z: number;
  /** Degrees. 0 is north, 90 is east. */
  heading: number;
  /** -2..2 in 45° steps. +2 is straight up. */
  pitch: number;
};

export type Step = "hold" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw" | "u" | "d";

export type Aim = -1 | 0 | 1;

export type Readout =
  | "no-crossing"
  | "parallel-close"
  | "same-line"
  | "same-gap"
  | "same-far"
  | "same-near"
  | "turned-away"
  | "near-but-turned"
  | "crossing-far"
  | "crossing-mid"
  | "crossing-near"
  | "facing-far"
  | "facing-near"
  | "near-aim"
  | "mixed"
  | "locked";

export type Vec3 = { x: number; y: number; z: number };

export const HEADING_NAME = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export const HEADING_VEC: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0, y: 1 },
  { x: 1, y: 1 },
  { x: 1, y: 0 },
  { x: 1, y: -1 },
  { x: 0, y: -1 },
  { x: -1, y: -1 },
  { x: -1, y: 0 },
  { x: -1, y: 1 },
];

export const STEP_DELTA: Record<Step, Vec3> = {
  hold: { x: 0, y: 0, z: 0 },
  n: { x: 0, y: 1, z: 0 },
  ne: { x: 1, y: 1, z: 0 },
  e: { x: 1, y: 0, z: 0 },
  se: { x: 1, y: -1, z: 0 },
  s: { x: 0, y: -1, z: 0 },
  sw: { x: -1, y: -1, z: 0 },
  w: { x: -1, y: 0, z: 0 },
  nw: { x: -1, y: 1, z: 0 },
  u: { x: 0, y: 0, z: 1 },
  d: { x: 0, y: 0, z: -1 },
};

export const STEP_LABEL: Record<Step, string> = {
  hold: "Hold",
  n: "North",
  ne: "Northeast",
  e: "East",
  se: "Southeast",
  s: "South",
  sw: "Southwest",
  w: "West",
  nw: "Northwest",
  u: "Up",
  d: "Down",
};

export const READOUT_COPY: Record<Readout, string> = {
  "no-crossing": "The beams run apart and never meet.",
  "parallel-close": "Nearly parallel — a gap still splits the lights.",
  "same-line": "They share a line, but the aims don't agree.",
  "same-gap": "Same direction, but a gap still splits the lights.",
  "same-far": "Same direction, one line — still a long way.",
  "same-near": "Same direction, one line. A short step can lock it.",
  "turned-away": "Those lines could cross, but a beam is aimed away.",
  "near-but-turned": "Close to a crossing, yet one beam faces the wrong way.",
  "crossing-far": "The beams cross, far from both lights.",
  "crossing-mid": "They cross. The lights are closing on that point.",
  "crossing-near": "A tight cross. Little distance left in the chalk.",
  "facing-far": "Same line, facing each other — still a long way.",
  "facing-near": "Facing, and close. A small correction can lock it.",
  "near-aim": "Close, but the beams point different ways.",
  mixed: "Same direction, within 5. The beams combine.",
  locked: "Side by side. The purple light holds.",
};

export const OPENING: { red: Pyramid; blue: Pyramid } = {
  red: { x: 2, y: 2, z: 0, heading: 45, pitch: 0 },
  blue: { x: 16, y: 4, z: 0, heading: 315, pitch: 0 },
};

export const OPENING_CUBE: { red: Pyramid; blue: Pyramid } = {
  red: { x: 2, y: 3, z: 2, heading: 90, pitch: 0 },
  blue: { x: 16, y: 14, z: 15, heading: 270, pitch: 1 },
};

export const PRESET_LOCK: { red: Pyramid; blue: Pyramid } = {
  red: { x: 8, y: 10, z: 0, heading: 90, pitch: 0 },
  blue: { x: 10, y: 10, z: 0, heading: 270, pitch: 0 },
};

/** Same direction, one line, close enough to lock on the cube. */
export const PRESET_SAME: { red: Pyramid; blue: Pyramid } = {
  red: { x: 6, y: 8, z: 9, heading: 90, pitch: 0 },
  blue: { x: 9, y: 8, z: 9, heading: 90, pitch: 0 },
};

export type Match = {
  red: Pyramid;
  blue: Pyramid;
  turn: Side;
  moves: number;
  lastBlocked: boolean;
  space: Space;
  phase: Phase;
  /** Moves left in the purple window. Two each, after the mix. */
  redLeft: number;
  blueLeft: number;
  broke: boolean;
  redBox: MoveBox | null;
  blueBox: MoveBox | null;
};

export type MoveBox = {
  x0: number;
  y0: number;
  z0: number;
  x1: number;
  y1: number;
  z1: number;
};

export type Analysis = {
  red: Pyramid;
  blue: Pyramid;
  dist: number;
  separation: number;
  parallel: boolean;
  side: number;
  redReach: boolean;
  blueReach: boolean;
  redToCross: number;
  blueToCross: number;
  facing: boolean;
  sameWay: boolean;
  /** Euclidean distance is within 5 — the lights mix. */
  mixed: boolean;
  /** Chebyshev distance ≤ 1 — standing on neighboring cells. */
  beside: boolean;
  locked: boolean;
  readout: Readout;
  /** Canvas radians in the crossing-plane view. */
  redAngle: number;
  blueAngle: number;
  /** True when the glass is a north-up compass (no pitch). */
  compass: boolean;
  /** 0 perpendicular, 1 parallel either way. Later this scales the score. */
  parallelAlign: number;
  /** 1 at a right angle, 2 when the beams are parallel. */
  multiplier: number;
};

const COS45 = Math.cos(Math.PI / 4);

export function beamAlign(a: Pyramid, b: Pyramid) {
  const align = Math.min(1, Math.max(0, Math.abs(dot(beamDir(a), beamDir(b)))));
  return { align, offDeg: (Math.acos(align) * 180) / Math.PI, multiplier: 1 + align };
}

export function alignDist(space: Space) {
  return space === "cube" ? 4 : ALIGN_DIST;
}

type LoosePyramid = Partial<Pyramid> & Pick<Pyramid, "x" | "y" | "heading">;

export function wrapDeg(n: number) {
  return ((Math.round(n) % 360) + 360) % 360;
}

export function fillPyramid(p: LoosePyramid): Pyramid {
  return {
    x: p.x,
    y: p.y,
    z: p.z ?? 0,
    heading: wrapDeg(p.heading),
    pitch: p.pitch ?? 0,
  };
}

function dot(a: Vec3, b: Vec3) {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function sub(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function scale(a: Vec3, s: number): Vec3 {
  return { x: a.x * s, y: a.y * s, z: a.z * s };
}

function len(a: Vec3) {
  return Math.hypot(a.x, a.y, a.z);
}

function normalize(a: Vec3): Vec3 {
  const l = len(a) || 1;
  return scale(a, 1 / l);
}

export function beamDir(p: Pyramid): Vec3 {
  const yaw = (wrapDeg(p.heading) * Math.PI) / 180;
  const pitch = (p.pitch ?? 0) * (Math.PI / 4);
  const c = Math.cos(pitch);
  return { x: Math.sin(yaw) * c, y: Math.cos(yaw) * c, z: Math.sin(pitch) };
}

function pos(p: Pyramid): Vec3 {
  return { x: p.x, y: p.y, z: p.z ?? 0 };
}

export function aimLabel(heading: number, pitch: number) {
  const deg = wrapDeg(heading);
  if (pitch >= 2) return "UP";
  if (pitch <= -2) return "DOWN";
  const name = HEADING_NAME[Math.round(deg / 45) % 8];
  if (pitch === 1) return `${deg}° ${name} up`;
  if (pitch === -1) return `${deg}° ${name} dn`;
  return `${deg}° ${name}`;
}

function viewAngles(da: Vec3, db: Vec3, parallel: boolean) {
  const level = Math.abs(da.z) < 1e-6 && Math.abs(db.z) < 1e-6;
  if (level) {
    return {
      compass: true,
      redAngle: Math.atan2(-da.y, da.x),
      blueAngle: Math.atan2(-db.y, db.x),
    };
  }
  let n: Vec3;
  if (parallel) {
    const helper = Math.abs(da.z) < 0.9 ? { x: 0, y: 0, z: 1 } : { x: 1, y: 0, z: 0 };
    n = normalize(cross3(da, helper));
  } else {
    n = normalize(cross3(da, db));
  }
  let worldUp: Vec3 = { x: 0, y: 0, z: 1 };
  if (Math.abs(dot(n, worldUp)) > 0.85) worldUp = { x: 0, y: 1, z: 0 };
  const up = normalize(sub(worldUp, scale(n, dot(n, worldUp))));
  const right = normalize(cross3(up, n));
  const angle = (dir: Vec3) => Math.atan2(-dot(dir, up), dot(dir, right));
  return { compass: false, redAngle: angle(da), blueAngle: angle(db) };
}

export function analyze(redIn: LoosePyramid, blueIn: LoosePyramid, space: Space = "flat"): Analysis {
  const red = fillPyramid(redIn);
  const blue = fillPyramid(blueIn);
  const da = beamDir(red);
  const db = beamDir(blue);
  const d = sub(pos(blue), pos(red));
  const dist = len(d);
  const n = cross3(da, db);
  const nLen = len(n);
  const parallel = nLen < 1e-3;
  const align = alignDist(space);

  let separation = 0;
  let redReach = false;
  let blueReach = false;
  let redToCross = dist;
  let blueToCross = dist;
  let side = 1;

  if (parallel) {
    const perp = sub(d, scale(da, dot(d, da)));
    separation = len(perp);
    const along = dot(d, da);
    redToCross = Math.abs(along);
    redReach = along >= -0.2;
    const alongB = dot(scale(d, -1), db);
    blueToCross = Math.abs(alongB);
    blueReach = alongB >= -0.2;
    side = perp.x + perp.y + perp.z >= 0 ? 1 : -1;
  } else {
    const nHat = scale(n, 1 / nLen);
    const t = dot(cross3(d, db), n) / (nLen * nLen);
    const s = dot(cross3(d, da), n) / (nLen * nLen);
    redToCross = Math.abs(t);
    blueToCross = Math.abs(s);
    redReach = t >= -1e-6;
    blueReach = s >= -1e-6;
    separation = Math.abs(dot(d, nHat));
    side = dot(d, nHat) >= 0 ? 1 : -1;
  }

  const sameWay = dot(da, db) >= COS45 - 1e-6;
  const span = Math.max(Math.abs(red.x - blue.x), Math.abs(red.y - blue.y), Math.abs(red.z - blue.z));
  const beside = span === 1;
  const mixed = dist <= MIX_DIST && sameWay;
  let facing = false;
  if (dist < 0.5) facing = dot(da, db) <= -COS45 + 1e-6;
  else {
    const ab = normalize(d);
    const ba = scale(ab, -1);
    facing = dot(da, ab) >= COS45 - 1e-6 && dot(db, ba) >= COS45 - 1e-6;
  }

  const collinear = separation < 1.25;
  const locked = beside && sameWay;

  let readout: Readout;
  if (locked) readout = "locked";
  else if (mixed) readout = "mixed";
  else if (dist <= MIX_DIST) readout = "near-aim";
  else if (sameWay && collinear && dist <= align + 4) readout = "same-near";
  else if (sameWay && collinear) readout = "same-far";
  else if (sameWay && !collinear) readout = "same-gap";
  else if (facing && collinear && dist <= align + 3) readout = "facing-near";
  else if (facing && collinear) readout = "facing-far";
  else if (parallel && collinear) readout = "same-line";
  else if (parallel && separation < 5) readout = "parallel-close";
  else if (parallel) readout = "no-crossing";
  else if (!redReach || !blueReach) {
    readout = Math.min(redToCross, blueToCross) <= 5 ? "near-but-turned" : "turned-away";
  } else if (Math.max(redToCross, blueToCross) <= 3.5) readout = "crossing-near";
  else if (Math.max(redToCross, blueToCross) <= 8) readout = "crossing-mid";
  else readout = "crossing-far";

  const view = viewAngles(da, db, parallel);
  const aligned = beamAlign(red, blue);
  return {
    red,
    blue,
    dist,
    separation,
    parallel,
    side,
    redReach,
    blueReach,
    redToCross,
    blueToCross,
    facing,
    sameWay,
    mixed,
    beside,
    locked,
    readout,
    redAngle: view.redAngle,
    blueAngle: view.blueAngle,
    compass: view.compass,
    parallelAlign: aligned.align,
    multiplier: aligned.multiplier,
  };
}

export function applyMove(p: LoosePyramid, step: Step, aim: Aim, pitchAim: Aim = 0, space: Space = "flat") {
  const src = fillPyramid(p);
  const delta = STEP_DELTA[step];
  const x = src.x + delta.x;
  const y = src.y + delta.y;
  const z = src.z + delta.z;
  const verticalBlocked = space === "flat" && delta.z !== 0;
  const off = x < 0 || y < 0 || z < 0 || x >= GRID || y >= GRID || z >= GRID;
  const moved = delta.x !== 0 || delta.y !== 0 || delta.z !== 0;
  const blocked = verticalBlocked || (off && moved);
  const pitch = space === "cube" ? Math.max(-2, Math.min(2, src.pitch + pitchAim)) : 0;
  return {
    blocked,
    pyramid: {
      x: blocked ? src.x : x,
      y: blocked ? src.y : y,
      z: blocked ? src.z : z,
      heading: wrapDeg(src.heading + aim * 45),
      pitch,
    },
  };
}

export type Place = { x: number; y: number; z: number };

function clampCell(n: number) {
  return Math.max(0, Math.min(GRID - 1, Math.round(n)));
}

function clampReach(from: number, to: number) {
  const lo = Math.max(0, from - MOVE_REACH);
  const hi = Math.min(GRID - 1, from + MOVE_REACH);
  return Math.max(lo, Math.min(hi, clampCell(to)));
}

/** Place within 15 cells, and point the beam at any heading. */
export function placeMove(p: LoosePyramid, place: Place, heading: number, pitch = 0) {
  const src = fillPyramid(p);
  return {
    blocked: false,
    pyramid: {
      x: clampReach(src.x, place.x),
      y: clampReach(src.y, place.y),
      z: clampReach(src.z, place.z),
      heading: wrapDeg(heading),
      pitch: Math.max(-2, Math.min(2, Math.round(pitch))),
    },
  };
}

function finishMove(match: Match, pyramid: Pyramid, blocked: boolean): Match {
  const space = match.space ?? "flat";
  const phase0 = match.phase ?? "seek";
  let redLeft = match.redLeft ?? 2;
  let blueLeft = match.blueLeft ?? 2;
  const red = match.turn === "red" ? pyramid : match.red;
  const blue = match.turn === "blue" ? pyramid : match.blue;
  const seen = analyze(red, blue, space);
  let phase: Phase = phase0;
  let broke = false;
  const aligned = seen.mixed;
  const together = seen.locked;

  if (phase0 === "joined" || together) {
    phase = "joined";
  } else if (phase0 === "mix") {
    if (match.turn === "red") redLeft = Math.max(0, redLeft - 1);
    else blueLeft = Math.max(0, blueLeft - 1);
    if (redLeft === 0 && blueLeft === 0) {
      broke = true;
      redLeft = 2;
      blueLeft = 2;
      phase = seen.dist <= MIX_DIST ? "near" : "seek";
    } else phase = aligned ? "mix" : seen.dist <= MIX_DIST ? "near" : "seek";
  } else if (aligned) {
    phase = "mix";
    redLeft = 2;
    blueLeft = 2;
  } else if (seen.dist <= MIX_DIST) {
    phase = "near";
  } else {
    phase = "seek";
  }

  const before = match.turn === "red" ? match.red : match.blue;
  const box: MoveBox = {
    x0: Math.min(before.x, pyramid.x),
    y0: Math.min(before.y, pyramid.y),
    z0: Math.min(before.z, pyramid.z),
    x1: Math.max(before.x, pyramid.x),
    y1: Math.max(before.y, pyramid.y),
    z1: Math.max(before.z, pyramid.z),
  };
  const joined = phase === "joined";
  return {
    red,
    blue,
    turn: joined ? match.turn : match.turn === "red" ? "blue" : "red",
    moves: match.moves + 1,
    lastBlocked: blocked,
    space,
    phase,
    redLeft,
    blueLeft,
    broke,
    redBox: match.turn === "red" ? box : (match.redBox ?? null),
    blueBox: match.turn === "blue" ? box : (match.blueBox ?? null),
  };
}

export function commitMove(match: Match, step: Step, aim: Aim, pitch: Aim = 0): Match {
  const space = match.space ?? "flat";
  const current = match.turn === "red" ? match.red : match.blue;
  const { pyramid, blocked } = applyMove(current, step, aim, pitch, space);
  return finishMove(match, pyramid, blocked);
}

export function commitPlace(match: Match, place: Place, heading: number, pitch = 0): Match {
  const current = match.turn === "red" ? match.red : match.blue;
  const other = match.turn === "red" ? match.blue : match.red;
  const { pyramid } = placeMove(current, place, heading, pitch);
  const taken = pyramid.x === other.x && pyramid.y === other.y && pyramid.z === other.z;
  if (taken) return { ...match, space: "cube" as const, lastBlocked: true };
  return finishMove({ ...match, space: "cube" }, pyramid, false);
}

export function createMatch(
  pair: { red: LoosePyramid; blue: LoosePyramid } = OPENING,
  space: Space = "flat",
): Match {
  return {
    red: fillPyramid(pair.red),
    blue: fillPyramid(pair.blue),
    turn: "red",
    moves: 0,
    lastBlocked: false,
    space,
    phase: "seek",
    redLeft: 2,
    blueLeft: 2,
    broke: false,
    redBox: null,
    blueBox: null,
  };
}

function randInt(n: number) {
  return Math.floor(Math.random() * n);
}

export function spawnPair(space: Space = "flat"): { red: Pyramid; blue: Pyramid } {
  const minDist = space === "cube" ? 14 : 12;
  for (let i = 0; i < 500; i++) {
    const red = fillPyramid({
      x: randInt(GRID),
      y: randInt(GRID),
      z: space === "cube" ? randInt(GRID) : 0,
      heading: randInt(360),
      pitch: space === "cube" ? randInt(5) - 2 : 0,
    });
    const blue = fillPyramid({
      x: randInt(GRID),
      y: randInt(GRID),
      z: space === "cube" ? randInt(GRID) : 0,
      heading: randInt(360),
      pitch: space === "cube" ? randInt(5) - 2 : 0,
    });
    if (len(sub(pos(blue), pos(red))) >= minDist) return { red, blue };
  }
  if (space === "cube") {
    return {
      red: { x: 1, y: 1, z: 1, heading: 45, pitch: 0 },
      blue: { x: 18, y: 16, z: 17, heading: 225, pitch: -1 },
    };
  }
  return {
    red: { x: 1, y: 1, z: 0, heading: 45, pitch: 0 },
    blue: { x: 18, y: 17, z: 0, heading: 225, pitch: 0 },
  };
}

export function headingToCanvas(heading: number) {
  const d = HEADING_VEC[((heading % 8) + 8) % 8] ?? HEADING_VEC[0];
  return Math.atan2(-d.y, d.x);
}
