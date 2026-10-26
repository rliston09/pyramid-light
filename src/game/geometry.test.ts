import assert from "node:assert/strict";
import test from "node:test";
import {
  analyze,
  applyMove,
  beamAlign,
  createMatch,
  commitMove,
  commitPlace,
  isRock,
  OPENING,
  OPENING_CUBE,
  PRESET_LOCK,
  PRESET_SAME,
  spawnPair,
} from "./geometry.ts";

test("rays meet at the predicted point", () => {
  const a = analyze({ x: 0, y: 0, heading: 90 }, { x: 2, y: 2, heading: 180 });
  assert.equal(a.parallel, false);
  assert.equal(a.redReach, true);
  assert.equal(a.blueReach, true);
  assert.ok(Math.abs(a.redToCross - 2) < 1e-6);
  assert.ok(Math.abs(a.blueToCross - 2) < 1e-6);
});

test("a beam aimed away does not reach the crossing", () => {
  const a = analyze({ x: 0, y: 0, heading: 270 }, { x: 2, y: 2, heading: 180 });
  assert.equal(a.redReach, false);
  assert.equal(a.blueReach, true);
  assert.equal(a.locked, false);
});

test("close beams mix only when they point the same way", () => {
  const apart = analyze({ x: 0, y: 0, heading: 0 }, { x: 0, y: 5, heading: 180 });
  assert.equal(apart.facing, true);
  assert.equal(apart.sameWay, false);
  assert.equal(apart.mixed, false);
  assert.equal(apart.locked, false);
  assert.equal(apart.readout, "near-aim");

  const same = analyze({ x: 0, y: 0, heading: 0 }, { x: 0, y: 3, heading: 0 });
  assert.equal(same.sameWay, true);
  assert.equal(same.mixed, true);
  assert.equal(same.locked, false);
});

test("preset lock and opening field", () => {
  const preset = analyze(PRESET_LOCK.red, PRESET_LOCK.blue);
  assert.equal(preset.dist <= 5, true);
  assert.equal(preset.sameWay, false);
  assert.equal(preset.mixed, false);
  const open = analyze(OPENING.red, OPENING.blue);
  assert.equal(open.locked, false);
  assert.equal(open.redReach, true);
  assert.equal(open.blueReach, true);
  assert.ok(open.dist >= 12);
});

test("the rim blocks a step but still turns the beam", () => {
  const r = applyMove({ x: 0, y: 0, heading: 0 }, "s", 1);
  assert.equal(r.blocked, true);
  assert.equal(r.pyramid.x, 0);
  assert.equal(r.pyramid.y, 0);
  assert.equal(r.pyramid.heading, 45);
});

test("spawns stay far apart", () => {
  for (let i = 0; i < 40; i++) {
    const pair = spawnPair();
    const d = Math.hypot(pair.red.x - pair.blue.x, pair.red.y - pair.blue.y);
    assert.ok(d >= 12);
    assert.equal(analyze(pair.red, pair.blue).locked, false);
  }
});

test("a commit hands the turn over until the lights join", () => {
  const next = commitMove(createMatch(OPENING), "hold", 0);
  assert.equal(next.turn, "blue");
  assert.equal(next.moves, 1);
  assert.equal(next.phase, "seek");
  const joined = commitMove(
    createMatch({
      red: { x: 8, y: 10, heading: 90 },
      blue: { x: 9, y: 10, heading: 90 },
    }),
    "hold",
    0,
  );
  assert.equal(joined.phase, "joined");
  assert.equal(joined.turn, "red");
});

test("mixing at 5 gives two moves each to stand beside", () => {
  let match = createMatch({
    red: { x: 6, y: 8, heading: 90 },
    blue: { x: 9, y: 8, heading: 90 },
  });
  assert.equal(analyze(match.red, match.blue).mixed, true);
  assert.equal(match.phase, "seek");
  match = commitMove(match, "hold", 0);
  assert.equal(match.phase, "mix");
  assert.equal(match.redLeft, 2);
  assert.equal(match.blueLeft, 2);
  match = commitMove(match, "w", 0);
  assert.equal(match.blue.x, 8);
  assert.equal(match.blueLeft, 1);
  assert.equal(match.phase, "mix");
  match = commitMove(match, "e", 0);
  assert.equal(match.red.x, 7);
  assert.equal(match.phase, "joined");
});

test("same direction inside 5 mixes, a wide gap does not", () => {
  const aligned = analyze({ x: 4, y: 4, z: 0, heading: 0, pitch: 0 }, { x: 4, y: 6, z: 0, heading: 0, pitch: 0 });
  assert.equal(aligned.sameWay, true);
  assert.equal(aligned.mixed, true);
  assert.equal(aligned.locked, false);

  const gapped = analyze({ x: 4, y: 4, z: 0, heading: 0, pitch: 0 }, { x: 14, y: 4, z: 0, heading: 0, pitch: 0 });
  assert.equal(gapped.sameWay, true);
  assert.equal(gapped.mixed, false);
  assert.equal(gapped.locked, false);
  assert.ok(gapped.separation > 3);
  assert.equal(gapped.readout, "same-gap");
});

test("one move can shift at most 15 cells on each axis", () => {
  const next = commitPlace(createMatch(OPENING_CUBE, "cube"), { x: 19, y: 0, z: 19 }, 180, -1);
  assert.equal(next.red.x, 17);
  assert.equal(next.red.y, 0);
  assert.equal(next.red.z, 17);
  assert.equal(next.red.heading, 180);
  assert.equal(next.red.pitch, -1);
  assert.equal(next.blue.x, OPENING_CUBE.blue.x);
  assert.equal(next.turn, "blue");
  assert.equal(next.redBox?.x0, 2);
  assert.equal(next.redBox?.x1, 17);
  assert.equal(next.redBox?.z0, 2);
  assert.equal(next.redBox?.z1, 17);
});

test("parallel alignment is a future score multiplier", () => {
  const same = beamAlign({ x: 0, y: 0, z: 0, heading: 0, pitch: 0 }, { x: 3, y: 0, z: 0, heading: 0, pitch: 0 });
  assert.ok(same.align > 0.99);
  assert.ok(same.offDeg < 1);
  assert.ok(Math.abs(same.multiplier - 2) < 0.01);

  const opposite = beamAlign({ x: 0, y: 0, z: 0, heading: 0, pitch: 0 }, { x: 3, y: 0, z: 0, heading: 180, pitch: 0 });
  assert.ok(opposite.align > 0.99);
  assert.ok(Math.abs(opposite.multiplier - 2) < 0.01);

  const right = beamAlign({ x: 0, y: 0, z: 0, heading: 0, pitch: 0 }, { x: 3, y: 0, z: 0, heading: 90, pitch: 0 });
  assert.ok(right.align < 0.02);
  assert.ok(Math.abs(right.offDeg - 90) < 1);
  assert.ok(Math.abs(right.multiplier - 1) < 0.02);
});

test("two pyramids cannot share a cell", () => {
  const stacked = analyze(
    { x: 4, y: 4, z: 4, heading: 0, pitch: 0 },
    { x: 4, y: 4, z: 4, heading: 0, pitch: 0 },
  );
  assert.equal(stacked.beside, false);
  assert.equal(stacked.locked, false);

  const match = createMatch(
    {
      red: { x: 4, y: 4, z: 4, heading: 0 },
      blue: { x: 4, y: 4, z: 6, heading: 0 },
    },
    "cube",
  );
  const next = commitPlace(match, { x: 4, y: 4, z: 6 }, 0, 0);
  assert.equal(next.red.x, 4);
  assert.equal(next.red.z, 4);
  assert.equal(next.lastBlocked, true);
  assert.equal(next.blockReason, "taken");
  assert.equal(next.turn, "red");
  assert.equal(next.moves, 0);
  assert.notEqual(next.phase, "joined");
});

test("four center rocks refuse a landing and do not spend the turn", () => {
  assert.equal(isRock(10, 10, 10), true);
  assert.equal(isRock(11, 10, 10), true);
  assert.equal(isRock(10, 11, 10), true);
  assert.equal(isRock(10, 10, 11), true);
  assert.equal(isRock(9, 10, 10), false);

  const match = createMatch(
    {
      red: { x: 10, y: 10, z: 8, heading: 0 },
      blue: { x: 2, y: 2, z: 2, heading: 90 },
    },
    "cube",
  );
  const blocked = commitPlace(match, { x: 10, y: 10, z: 10 }, 0, 0);
  assert.equal(blocked.red.z, 8);
  assert.equal(blocked.lastBlocked, true);
  assert.equal(blocked.blockReason, "rock");
  assert.equal(blocked.turn, "red");
  assert.equal(blocked.moves, 0);

  const beside = commitPlace(match, { x: 9, y: 10, z: 10 }, 0, 0);
  assert.equal(beside.red.x, 9);
  assert.equal(beside.red.z, 10);
  assert.equal(beside.blockReason, null);
  assert.equal(beside.turn, "blue");

  for (let i = 0; i < 40; i++) {
    const pair = spawnPair("cube");
    assert.equal(isRock(pair.red.x, pair.red.y, pair.red.z), false);
    assert.equal(isRock(pair.blue.x, pair.blue.y, pair.blue.z), false);
  }
});

test("the cube keeps up-steps and same-direction locks in 3D", () => {
  const moved = applyMove({ x: 1, y: 1, z: 1, heading: 0, pitch: 0 }, "u", 0, 1, "cube");
  assert.equal(moved.blocked, false);
  assert.equal(moved.pyramid.z, 2);
  assert.equal(moved.pyramid.pitch, 1);
  const flat = applyMove({ x: 1, y: 1, z: 0, heading: 0, pitch: 0 }, "u", 0, 0, "flat");
  assert.equal(flat.blocked, true);
  assert.equal(flat.pyramid.z, 0);

  const same = analyze(PRESET_SAME.red, PRESET_SAME.blue, "cube");
  assert.equal(same.mixed, true);
  assert.equal(same.locked, false);
  assert.equal(same.compass, true);

  const skew = analyze(
    { x: 0, y: 0, z: 0, heading: 90, pitch: 0 },
    { x: 0, y: 0, z: 6, heading: 0, pitch: 0 },
    "cube",
  );
  assert.ok(skew.separation > 4);
  assert.equal(skew.locked, false);
  assert.equal(skew.compass, true);
});

