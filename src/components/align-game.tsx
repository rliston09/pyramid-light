import { useEffect, useMemo, useState } from "react";
import { CircleHelp, Triangle } from "lucide-react";
import { CrossGlass } from "@/components/cross-glass";
import { CubeStage } from "@/components/cube-stage";
import {
  type Aim,
  type Match,
  type Place,
  type Step,
  aimLabel,
  analyze,
  beamAlign,
  commitMove,
  commitPlace,
  createMatch,
  GRID,
  MIX_DIST,
  MOVE_REACH,
  OPENING_CUBE,
  PRESET_SAME,
  READOUT_COPY,
  spawnPair,
} from "@/game/geometry";
import { playCommit, playLock, playSelect, unlockAudio } from "@/game/sfx";

const BEST_KEY = "pyramid-light-best-v1";
const REACH = Math.hypot(GRID - 1, GRID - 1, GRID - 1);

function cx(...parts: Array<string | false | undefined | null>) {
  return parts.filter(Boolean).join(" ");
}

export function AlignGame() {
  const [match, setMatch] = useState<Match>(() => createMatch(OPENING_CUBE, "cube"));
  const [started, setStarted] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [place, setPlace] = useState<Place>({ x: OPENING_CUBE.red.x, y: OPENING_CUBE.red.y, z: OPENING_CUBE.red.z });
  const [heading, setHeading] = useState(OPENING_CUBE.red.heading);
  const [pitch, setPitch] = useState(OPENING_CUBE.red.pitch);
  const [panel, setPanel] = useState<"place" | "aim">("place");
  const [best, setBest] = useState<number | null>(null);
  const [lockT, setLockT] = useState(0);
  const [gameId, setGameId] = useState(0);
  const [beamFlash, setBeamFlash] = useState(false);
  const [beamPinned, setBeamPinned] = useState(false);

  const analysis = useMemo(() => analyze(match.red, match.blue, match.space), [match]);
  const joined = started && match.phase === "joined";
  const showRules = rulesOpen;
  const actor = match.turn === "red" ? match.red : match.blue;
  const parallel = useMemo(() => {
    const mine = { ...actor, heading, pitch };
    const other = match.turn === "red" ? match.blue : match.red;
    return beamAlign(mine, other);
  }, [actor, heading, pitch, match.turn, match.blue, match.red]);

  useEffect(() => {
    setMatch(createMatch(spawnPair("cube"), "cube"));
    try {
      const raw = localStorage.getItem(BEST_KEY);
      if (raw) {
        const n = Number(raw);
        if (Number.isFinite(n)) setBest(n);
      }
    } catch {
      /* private mode */
    }
  }, []);

  useEffect(() => {
    if (!joined) {
      setLockT(0);
      return;
    }
    playLock();
    if (match.moves > 0) {
      setBest((prev) => {
        const score = prev == null ? match.moves : Math.min(prev, match.moves);
        try {
          localStorage.setItem(BEST_KEY, String(score));
        } catch {
          /* ignore */
        }
        return score;
      });
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setLockT(1);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / 420);
      setLockT(p);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [joined, gameId]);

  useEffect(() => {
    const who = match.turn === "red" ? match.red : match.blue;
    setPlace({ x: who.x, y: who.y, z: who.z });
    setHeading(who.heading);
    setPitch(who.pitch);
  }, [match.turn, match.moves, gameId, match.red, match.blue]);

  useEffect(() => {
    if (!started || match.moves === 0) return;
    setBeamFlash(true);
    const id = window.setTimeout(() => setBeamFlash(false), 1500);
    return () => window.clearTimeout(id);
  }, [match.moves, gameId, started]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLButtonElement && (e.key === "Enter" || e.key === " ")) return;
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (!started || joined || showRules) {
        if ((key === "Enter" || key === " ") && !started) {
          e.preventDefault();
          begin();
        }
        return;
      }
      if (key === "u" || key === "j" || (e.shiftKey && (e.key === "ArrowUp" || e.key === "ArrowDown"))) {
        e.preventDefault();
        nudge("z", key === "u" || e.key === "ArrowUp" ? 1 : -1);
        return;
      }
      if (key === "i" || key === "k") {
        e.preventDefault();
        setPitch((p) => Math.max(-2, Math.min(2, p + (key === "i" ? 1 : -1))));
        playSelect();
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        nudge("x", e.key === "ArrowRight" ? 1 : -1);
        return;
      }
      if (e.key === "ArrowUp" || e.key === "ArrowDown") {
        e.preventDefault();
        nudge("y", e.key === "ArrowUp" ? 1 : -1);
        return;
      }
      if (key === "," || key === "[") {
        e.preventDefault();
        setHeading((h) => (h + 345) % 360);
        playSelect();
      } else if (key === "." || key === "]") {
        e.preventDefault();
        setHeading((h) => (h + 15) % 360);
        playSelect();
      } else if (key === "Enter") {
        e.preventDefault();
        commit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    window.__align = {
      snapshot: () => ({
        started,
        locked: joined,
        moves: match.moves,
        turn: match.turn,
        readout: analysis.readout,
        dist: analysis.dist,
        separation: analysis.separation,
        sameWay: analysis.sameWay,
        space: match.space,
        red: match.red,
        blue: match.blue,
        place,
        heading,
        pitch,
      }),
      commit: (nextStep: Step, nextAim: Aim) => {
        setStarted(true);
        setRulesOpen(false);
        setMatch((current) => commitMove(current, nextStep, nextAim, 0));
        setHeading(0);
        setPitch(0);
      },
      loadLock: () => {
        setMatch(createMatch(PRESET_SAME, "cube"));
        setStarted(true);
        setRulesOpen(false);
        setHeading(0);
        setPitch(0);
        setGameId((n) => n + 1);
      },
      newMatch: () => fresh(),
    };
    return () => {
      delete window.__align;
    };
  });

  function begin() {
    unlockAudio();
    setStarted(true);
    setRulesOpen(false);
  }

  function fresh() {
    unlockAudio();
    setMatch(createMatch(spawnPair("cube"), "cube"));
    setStarted(true);
    setRulesOpen(false);
    setHeading(0);
    setPitch(0);
    setPanel("place");
    setLockT(0);
    setGameId((n) => n + 1);
  }

  function nudge(axis: "x" | "y" | "z", delta: number) {
    unlockAudio();
    const origin = axis === "x" ? actor.x : axis === "y" ? actor.y : actor.z;
    const lo = Math.max(0, origin - MOVE_REACH);
    const hi = Math.min(GRID - 1, origin + MOVE_REACH);
    setPlace((prev) => ({
      ...prev,
      [axis]: Math.max(lo, Math.min(hi, prev[axis] + delta)),
    }));
    playSelect();
  }

  function commit() {
    if (!started || joined) return;
    unlockAudio();
    const next = commitPlace(match, place, heading, pitch);
    setMatch(next);
    if (next.lastBlocked && next.moves === match.moves) return;
    if (next.phase !== "joined") playCommit();
  }

  const tone = joined ? "green" : match.turn === "red" ? "red" : "blue";
  const showBeam = beamFlash || beamPinned;
  const status =
    match.phase === "joined"
      ? "Side by side"
      : match.phase === "mix"
        ? `Mix · ${match.redLeft} & ${match.blueLeft}`
        : match.phase === "near"
          ? "Close"
          : match.turn === "red"
          ? "Red moves"
          : "Blue moves";

  return (
    <main
      className="game-root mx-auto flex h-dvh max-w-lg flex-col bg-bg text-fg"
      onPointerDown={unlockAudio}
    >
      <header className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4 pb-2">
        <div className="min-w-0">
          <p className="font-mono text-xs tracking-widest text-muted">CUBE · 20×20×20</p>
          <h1 className="font-display text-2xl leading-none font-extrabold tracking-tight sm:text-3xl">
            Pyramid Light
          </h1>
        </div>
        <button
          type="button"
          className="mt-1 grid size-11 shrink-0 place-items-center rounded-full border border-line bg-surface text-fg"
          aria-label="How alignment works"
          onClick={() => {
            unlockAudio();
            setRulesOpen((v) => !v);
          }}
        >
          <CircleHelp className="size-5" />
        </button>
      </header>

      <div className="flex shrink-0 items-center justify-between gap-3 px-4">
        <p
          className={cx(
            "inline-flex items-center gap-2 font-display text-sm font-bold tracking-wide uppercase",
            tone === "red" && "text-red",
            tone === "blue" && "text-blue",
            tone === "green" && "text-green",
          )}
        >
          <Triangle className={cx("size-3.5 fill-current", joined && "rotate-180")} aria-hidden />
          <span className={match.phase === "mix" ? "text-mix" : undefined}>{status}</span>
        </p>
        <p className="font-mono text-xs text-muted">
          {joined ? "" : `Move ${match.moves}`}
          {best != null ? ` · Best ${best}` : ""}
        </p>
        <button
          type="button"
          aria-pressed={beamPinned}
          className={cx(
            "h-8 rounded-full px-3 font-mono text-[10px] tracking-wide",
            beamPinned || beamFlash ? "bg-mix text-bg" : "border border-line bg-surface text-muted",
          )}
          onClick={() => {
            unlockAudio();
            setBeamPinned((v) => !v);
            setBeamFlash(false);
          }}
        >
          {beamFlash ? "Beam" : beamPinned ? "Beam saved" : "Saved beam"}
        </button>
      </div>

      <Proximity dist={analysis.dist} mixed={match.phase === "mix" || match.phase === "joined"} close={match.phase === "near"} />
      <Parallel align={parallel.align} offDeg={parallel.offDeg} multiplier={parallel.multiplier} />

      <div className="relative min-h-0 flex-1">
        <CubeStage
          red={match.red}
          blue={match.blue}
          turn={match.turn}
          otherBeam={analysis.dist <= REACH / 2}
          mixed={match.phase === "mix" || match.phase === "joined"}
          finale={match.phase === "joined"}
          space="cube"
          ghost={
            started
              ? { x: place.x, y: place.y, z: place.z, heading, pitch }
              : null
          }
          redBox={match.redBox}
          blueBox={match.blueBox}
        />
        {showBeam ? (
          <div className="absolute inset-2 z-10 overflow-hidden rounded-2xl border border-line bg-bg/95">
            <CrossGlass analysis={analysis} lockT={lockT} className="flex h-full w-full items-center justify-center" />
          </div>
        ) : null}
      </div>

      <p className="shrink-0 px-4 py-1 text-center text-sm leading-snug text-fg" aria-live="polite">
        {match.lastBlocked && started ? "That cell is taken. " : ""}
        {match.phase === "mix"
          ? "Beams combined. Two moves each to stand on neighboring cells."
          : match.phase === "near"
            ? "Close, but the beams point different ways."
            : match.broke && match.phase === "seek"
            ? "That window closed. Close to 5 and the lights mix again."
            : READOUT_COPY[analysis.readout]}
      </p>

      <section className="mt-auto shrink-0 border-t border-line px-4 pt-3 pb-4">
        {showRules ? (
          <Rules started={started} onBegin={begin} onClose={() => setRulesOpen(false)} />
        ) : !started ? (
          <button
            type="button"
            className="h-12 w-full rounded-xl bg-red font-display text-base font-bold text-bg"
            onClick={begin}
          >
            Red takes the first move
          </button>
        ) : joined ? (
          <div className="flex flex-col items-center gap-3 py-2 text-center">
            <p className="font-display text-2xl font-extrabold text-mix">Together</p>
            <p className="text-sm text-muted">
              Locked in {match.moves} {match.moves === 1 ? "move" : "moves"}
              {best != null ? ` · best ${best}` : ""}.
            </p>
            <button
              type="button"
              className="h-12 w-full rounded-xl bg-green font-display text-base font-bold text-bg"
              onClick={fresh}
            >
              New alignment
            </button>
          </div>
        ) : (
          <Controls
            turn={match.turn}
            panel={panel}
            place={place}
            reach={{
              x: [Math.max(0, actor.x - MOVE_REACH), Math.min(GRID - 1, actor.x + MOVE_REACH)],
              y: [Math.max(0, actor.y - MOVE_REACH), Math.min(GRID - 1, actor.y + MOVE_REACH)],
              z: [Math.max(0, actor.z - MOVE_REACH), Math.min(GRID - 1, actor.z + MOVE_REACH)],
            }}
            heading={heading}
            pitch={pitch}
            onPanel={setPanel}
            onPlace={(axis, value) => {
              const origin = axis === "x" ? actor.x : axis === "y" ? actor.y : actor.z;
              const lo = Math.max(0, origin - MOVE_REACH);
              const hi = Math.min(GRID - 1, origin + MOVE_REACH);
              setPlace((prev) => ({ ...prev, [axis]: Math.max(lo, Math.min(hi, value)) }));
              if (match.lastBlocked) setMatch((m) => ({ ...m, lastBlocked: false }));
            }}
            onHeading={(value) => setHeading(((Math.round(value) % 360) + 360) % 360)}
            onPitch={(value) => setPitch(Math.max(-2, Math.min(2, Math.round(value))))}
            onCommit={commit}
          />
        )}
      </section>
    </main>
  );
}

function Rules({
  started,
  onBegin,
  onClose,
}: {
  started: boolean;
  onBegin: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-1.5 text-sm leading-snug text-muted">
        <li>
          <span className="font-mono text-fg">01 </span>
          Same screen. Your pyramid stays hidden from the other player until the end. Their beam shows once proximity is halfway.
        </li>
        <li>
          <span className="font-mono text-fg">02 </span>
          One move can shift you by 15 cells on each axis, and aim anywhere in 360°. A taken cell is refused and you try again. You only see your own last move.
        </li>
        <li>
          <span className="font-mono text-fg">03 </span>
          Inside 5, the beams combine only when they point the same way. The parallel meter is how close the beams are, and later it multiplies the score.
        </li>
        <li>
          <span className="font-mono text-fg">04 </span>
          Then two moves each to stand on neighboring cells. Miss that, and the mix fades.
        </li>
      </ol>
      {started ? (
        <button
          type="button"
          className="h-12 w-full rounded-xl bg-fg font-display text-base font-bold text-bg"
          onClick={onClose}
        >
          Back to the move
        </button>
      ) : (
        <button
          type="button"
          className="h-12 w-full rounded-xl bg-red font-display text-base font-bold text-bg"
          onClick={onBegin}
        >
          Red takes the first move
        </button>
      )}
    </div>
  );
}

function Parallel({ align, offDeg, multiplier }: { align: number; offDeg: number; multiplier: number }) {
  const hot = align > 0.92;
  return (
    <div className="shrink-0 px-4 pb-2">
      <div className="mb-1 flex items-baseline justify-between font-mono text-[10px] tracking-widest text-muted">
        <span>PARALLEL</span>
        <span className={hot ? "text-green" : "text-fg"}>
          {offDeg < 1 ? "0°" : `${Math.round(offDeg)}°`} · ×{multiplier.toFixed(2)}
        </span>
      </div>
      <div
        className="h-2 rounded-full bg-surface"
        role="meter"
        aria-label="How close the beams are to parallel"
        aria-valuemin={1}
        aria-valuemax={2}
        aria-valuenow={Number(multiplier.toFixed(2))}
      >
        <div
          className="h-full rounded-full"
          style={{ width: `${align * 100}%`, background: hot ? "var(--color-green)" : "var(--color-fg)" }}
        />
      </div>
    </div>
  );
}

function Proximity({ dist, mixed, close }: { dist: number; mixed: boolean; close: boolean }) {
  const near = Math.max(0, Math.min(1, 1 - dist / REACH));
  const mixAt = 1 - MIX_DIST / REACH;
  const fill = mixed ? "var(--color-mix)" : close ? "var(--color-fg)" : "var(--color-muted)";
  const reading = dist < 10 ? dist.toFixed(1) : String(Math.round(dist));
  const tag = mixed ? `${reading} · MIX` : close ? `${reading} · CLOSE` : reading;
  return (
    <div className="shrink-0 px-4 pt-1 pb-3">
      <div className="mb-1 flex items-baseline justify-between font-mono text-[10px] tracking-widest text-muted">
        <span>PROXIMITY</span>
        <span className={mixed ? "text-mix" : "text-fg"}>{tag}</span>
      </div>
      <div className="relative h-2 rounded-full bg-surface" role="meter" aria-valuemin={0} aria-valuemax={Math.round(REACH)} aria-valuenow={Math.round(dist)} aria-label="Proximity">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${near * 100}%`, background: fill }} />
        <div className="absolute -top-1 h-4 w-px bg-fg/80" style={{ left: `${mixAt * 100}%` }} />
        <span className="absolute top-2 font-mono text-[9px] text-muted" style={{ left: `calc(${mixAt * 100}% - 0.3rem)` }}>
          5
        </span>
      </div>
    </div>
  );
}

function Controls({
  turn,
  panel,
  place,
  reach,
  heading,
  pitch,
  onPanel,
  onPlace,
  onHeading,
  onPitch,
  onCommit,
}: {
  turn: "red" | "blue";
  panel: "place" | "aim";
  place: Place;
  reach: { x: [number, number]; y: [number, number]; z: [number, number] };
  heading: number;
  pitch: number;
  onPanel: (panel: "place" | "aim") => void;
  onPlace: (axis: "x" | "y" | "z", value: number) => void;
  onHeading: (heading: number) => void;
  onPitch: (pitch: number) => void;
  onCommit: () => void;
}) {
  const hot = turn === "red" ? "bg-red text-bg" : "bg-blue text-bg";
  const idle = "border border-line bg-surface text-fg";
  const accent = turn === "red" ? "#ff2d55" : "#3ec6ff";
  return (
    <div className="flex flex-col gap-2">
      <p className="text-center font-mono text-xs text-muted">
        {place.x},{place.y},{place.z}
        {" · "}
        {aimLabel(heading, pitch)}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={panel === "place"}
          className={cx("h-10 rounded-xl font-mono text-xs", panel === "place" ? hot : idle)}
          onClick={() => onPanel("place")}
        >
          Place
        </button>
        <button
          type="button"
          aria-pressed={panel === "aim"}
          className={cx("h-10 rounded-xl font-mono text-xs", panel === "aim" ? hot : idle)}
          onClick={() => onPanel("aim")}
        >
          Aim
        </button>
      </div>
      {panel === "place" ? (
        <div className="flex flex-col gap-1">
          {(["x", "y", "z"] as const).map((axis) => (
            <label key={axis} className="grid grid-cols-[1.25rem_1fr_1.75rem] items-center gap-2">
              <span className="font-mono text-xs tracking-widest text-muted uppercase">{axis}</span>
              <input
                type="range"
                min={reach[axis][0]}
                max={reach[axis][1]}
                step={1}
                value={place[axis]}
                aria-label={`Place ${axis}`}
                onChange={(e) => onPlace(axis, Number(e.target.value))}
                className="h-8 w-full cursor-pointer appearance-none bg-transparent"
                style={{ accentColor: accent }}
              />
              <span className="text-right font-mono text-xs text-fg">{place[axis]}</span>
            </label>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-1">
          <label className="grid grid-cols-[2.5rem_1fr_3.25rem] items-center gap-2">
            <span className="font-mono text-[10px] tracking-widest text-muted">YAW</span>
            <input
              type="range"
              min={0}
              max={359}
              step={1}
              value={heading}
              aria-label="Beam angle"
              onChange={(e) => onHeading(Number(e.target.value))}
              className="h-8 w-full cursor-pointer appearance-none bg-transparent"
              style={{ accentColor: accent }}
            />
            <span className="text-right font-mono text-xs text-fg">{heading}°</span>
          </label>
          <label className="grid grid-cols-[2.5rem_1fr_3.25rem] items-center gap-2">
            <span className="font-mono text-[10px] tracking-widest text-muted">PITCH</span>
            <input
              type="range"
              min={-2}
              max={2}
              step={1}
              value={pitch}
              aria-label="Beam pitch"
              onChange={(e) => onPitch(Number(e.target.value))}
              className="h-8 w-full cursor-pointer appearance-none bg-transparent"
              style={{ accentColor: accent }}
            />
            <span className="text-right font-mono text-xs text-fg">{pitch > 0 ? `+${pitch}` : pitch}</span>
          </label>
        </div>
      )}
      <button type="button" className={cx("h-12 w-full rounded-xl font-display text-base font-bold", hot)} onClick={onCommit}>
        Commit move
      </button>
    </div>
  );
}

declare global {
  interface Window {
    __align?: {
      snapshot: () => unknown;
      commit: (step: Step, aim: Aim) => void;
      loadLock: () => void;
      newMatch: () => void;
    };
  }
}
