import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { GameProps, GameResult } from '../../lib/types';
import { mean, sum, pct, secs } from '../../lib/util';
import { useTimeouts } from '../../lib/hooks';
import { RetryIcon } from '../../components/Icons';
import {
  EATS,
  LABEL,
  ROWERS,
  boatProblem,
  cross,
  hasSailor,
  minCrossings,
  seatsUsed,
  solve,
  tripConflict,
  type Conflict,
  type Kind,
  type Puzzle,
  type State,
} from './engine';
import { PRACTICE, TIER_LABEL, pickRun } from './puzzles';
import { flatParts, snapshot } from '../../three/voxel';
import FerryScene, { SAIL_MS, lookFor } from './FerryScene';
import './ferry.css';

interface Rec {
  puzzle: Puzzle;
  title: string;
  min: number;
  crossings: number;
  failures: number;
  solved: boolean;
  planMs: number;
  totalMs: number;
}

/** A small rendered portrait of a character, for the rule chips. */
function Portrait({ kind }: { kind: Kind }) {
  const src = useMemo(() => {
    const look = lookFor([kind], 0);
    return snapshot(`portrait-${look.id}`, flatParts(look.model), { yaw: -0.7, pitch: 0.25, w: 96, h: 96 });
  }, [kind]);
  return src ? <img className="portrait" src={src} alt="" /> : null;
}

const lc = (k: Kind) => LABEL[k].toLowerCase();

function Rules({ p }: { p: Puzzle }) {
  const present = new Set(p.kinds);
  const sailor = hasSailor(p);
  const chips: { key: string; warn?: boolean; body: ReactNode }[] = [];

  if (sailor) chips.push({ key: 'seats', body: `Sailor + ${p.capacity} seat${p.capacity > 1 ? 's' : ''}` });
  else {
    const rowers = [...new Set(p.kinds.filter((k) => ROWERS.includes(k)))];
    chips.push({ key: 'seats', body: `No sailor · raft holds ${p.capacity}` });
    chips.push({
      key: 'rowers',
      warn: true,
      body: (
        <>
          Only {rowers.map((k) => <Portrait key={k} kind={k} />)} {rowers.map(lc).join(', ')} can row
        </>
      ),
    });
    chips.push({ key: 'everywhere', warn: true, body: 'Rules apply on both banks and on the raft' });
  }
  if (present.has('bear')) chips.push({ key: 'bear', warn: true, body: <><Portrait kind="bear" /> The bear takes 2 seats</> });
  if (sailor && present.has('kid'))
    chips.push({ key: 'kid', warn: true, body: <><Portrait kind="kid" /> A kid can never travel as the only passenger</> });
  for (const a of Object.keys(EATS) as Kind[]) {
    if (!present.has(a)) continue;
    for (const b of EATS[a]!)
      if (present.has(b))
        chips.push({ key: a + b, warn: true, body: <><Portrait kind={a} /> {LABEL[a]} eats <Portrait kind={b} /> {lc(b)}</> });
  }
  if (present.has('wolf') && present.has('sheep'))
    chips.push({
      key: 'wolves',
      warn: true,
      body: <><Portrait kind="wolf" /> Wolves eat a <Portrait kind="sheep" /> sheep when they outnumber the sheep</>,
    });
  if (present.has('dog'))
    chips.push({
      key: 'dog',
      body: <><Portrait kind="dog" /> Nobody gets eaten where the sheepdog is{present.has('bear') ? ', except by the bear' : ''}</>,
    });
  if (present.has('thief'))
    chips.push({ key: 'thief', warn: true, body: <><Portrait kind="thief" /> The thief robs the family unless the <Portrait kind="police" /> police officer is there</> });
  if (present.has('father') && present.has('daughter'))
    chips.push({ key: 'fd', warn: true, body: <><Portrait kind="father" /> Father can't be with a <Portrait kind="daughter" /> daughter unless the mother is there</> });
  if (present.has('mother') && present.has('son'))
    chips.push({ key: 'ms', warn: true, body: <><Portrait kind="mother" /> Mother can't be with a <Portrait kind="son" /> son unless the father is there</> });

  return (
    <div className="rules">
      {chips.map((c) => (
        <span key={c.key} className={`rule-chip ${c.warn ? 'warn' : ''}`}>
          {c.body}
        </span>
      ))}
    </div>
  );
}

/** Describes a hinted trip in words, e.g. "Take the chicken across." */
function describeTrip(p: Puzzle, load: number[], boat: 0 | 1) {
  const dir = boat === 0 ? 'across' : 'back';
  if (!load.length) return `Sail ${dir} with nobody on board.`;
  const names = load.map((i) => `the ${lc(p.kinds[i])}`);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}` : names[0];
  return `Take ${list} ${dir}.`;
}

/** Fewest trips and nobody lost. */
const isPerfect = (r: Rec) => r.solved && r.crossings === r.min && r.failures === 0;

/** How the previous attempt at a puzzle went, for the retry round. */
function lastTry(r: Rec) {
  if (!r.solved) return 'Last time you skipped this one.';
  const failed = r.failures ? ` and had ${r.failures} failed attempt${r.failures > 1 ? 's' : ''}` : '';
  return `Last time you used ${r.crossings} trips${failed}.`;
}

export default function FerryGame({ onFinish, practice, retry: retryItems }: GameProps) {
  // A retry round replays the records of puzzles that weren't solved perfectly in the test.
  const review = retryItems as Rec[] | undefined;
  const [puzzles] = useState(() => (practice ? PRACTICE : review ? review.map((r) => r.puzzle) : pickRun()));
  // The real test hides the fewest possible trips and the hints, so it measures your own planning.
  const guided = practice || !!review;
  const [mins] = useState(() => puzzles.map((p) => minCrossings(p) ?? 99));
  const [idx, setIdx] = useState(0);
  const p = puzzles[idx];
  const sailor = hasSailor(p);
  const fresh = (pz: Puzzle): State => ({ side: pz.kinds.map(() => 0), boat: 0 });
  const [st, setSt] = useState<State>(() => fresh(puzzles[0]));
  const [load, setLoad] = useState<number[]>([]);
  const [sailing, setSailing] = useState(false);
  const [crossings, setCrossings] = useState(0);
  const [failures, setFailures] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [eaten, setEaten] = useState<Conflict | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; title: string; text: string } | null>(null);
  const [hint, setHint] = useState<{ load: number[]; text: string } | null>(null);
  const hintsUsed = useRef(0);
  const t0 = useRef(performance.now());
  const firstSail = useRef<number | null>(null);
  const recs = useRef<Rec[]>([]);
  const later = useTimeouts();

  const busy = sailing || !!eaten || !!banner;
  const boatShown = sailing ? 1 - st.boat : st.boat;

  function say(msg: string) {
    setToast(msg);
    later(() => setToast((t) => (t === msg ? null : t)), 2600);
  }

  function toggle(i: number) {
    if (busy) return;
    if (load.includes(i)) return setLoad(load.filter((x) => x !== i));
    if (st.side[i] !== st.boat) return say('The raft is on the other side of the river.');
    if (seatsUsed(p, [...load, i]) > p.capacity)
      return say(p.kinds[i] === 'bear' ? 'The bear needs 2 free seats.' : `The raft only has ${p.capacity} seat${p.capacity > 1 ? 's' : ''}.`);
    setLoad([...load, i]);
  }

  function showHint() {
    if (busy) return;
    const path = solve(p, st);
    if (!path?.length) return;
    hintsUsed.current++;
    setHint({ load: path[0], text: `${describeTrip(p, path[0], st.boat)} (${path.length} trip${path.length > 1 ? 's' : ''} left from here)` });
  }

  function sail() {
    if (busy) return;
    const problem = boatProblem(p, load);
    if (problem) return say(problem);
    if (firstSail.current === null) firstSail.current = performance.now();
    const danger = tripConflict(p, st, load);
    const used = crossings + 1;
    setCrossings(used);
    setSailing(true);
    setHint(null);
    later(() => {
      if (danger) {
        setEaten(danger);
        setFailures((f) => f + 1);
        return;
      }
      // Passengers stay on board until the player taps them off.
      const next = cross(st, load);
      setSt(next);
      setSailing(false);
      if (next.side.every((s) => s === 1)) complete(true, used);
    }, SAIL_MS);
  }

  function retry() {
    setEaten(null);
    setSailing(false);
    setSt(fresh(p));
    setLoad([]);
  }

  function restart() {
    if (busy) return;
    setSt(fresh(p));
    setLoad([]);
    setHint(null);
  }

  function complete(solved: boolean, used: number) {
    const now = performance.now();
    const min = mins[idx];
    recs.current.push({
      puzzle: p,
      title: p.title,
      min,
      crossings: used,
      failures,
      solved,
      planMs: (firstSail.current ?? now) - t0.current,
      totalMs: now - t0.current,
    });
    setHint(null);
    setBanner(
      solved
        ? used === min && failures === 0
          ? { ok: true, title: 'Perfect crossing!', text: `Everyone made it across in the minimum ${min} trips.` }
          : { ok: true, title: 'Everyone made it!', text: `${used} trips in total. The fewest possible is ${min}.` }
        : { ok: false, title: 'Puzzle skipped', text: `This one can be done in ${min} trips.` },
    );
    later(() => {
      if (idx + 1 >= puzzles.length)
        return onFinish(practice ? practiceResult(recs.current, hintsUsed.current) : review ? retryResult(recs.current, hintsUsed.current) : analyse(recs.current));
      const n = idx + 1;
      setIdx(n);
      setSt(fresh(puzzles[n]));
      setLoad([]);
      setSailing(false);
      setEaten(null);
      setCrossings(0);
      setFailures(0);
      setBanner(null);
      t0.current = performance.now();
      firstSail.current = null;
    }, 2800);
  }

  const eatenText = eaten
    ? sailor
      ? `While the sailor was away, ${eaten.text}!`
      : `Oh dear: ${eaten.text}!`
    : '';

  return (
    <div className="stage ferry-stage">
      <div className="hud">
        <div className="hud-group">
          <span className="pill">
            Puzzle {idx + 1} / {puzzles.length}
          </span>
          <span className={`pill tier-${p.tier}`}>{TIER_LABEL[p.tier]}</span>
          <span className="pill">
            Trips <strong>{crossings}</strong>
          </span>
          {guided && <span className="pill pill-accent">Best possible: {mins[idx]}</span>}
          {failures > 0 && <span className="pill pill-bad">Failed attempts: {failures}</span>}
        </div>
        <div className="hud-group">
          {guided && (
            <button className="btn btn-secondary btn-sm" onClick={showHint} disabled={busy}>
              💡 Hint
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={restart} disabled={busy}>
            <RetryIcon size={16} /> Restart
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => !busy && complete(false, crossings)} disabled={busy}>
            Skip
          </button>
        </div>
      </div>
      <div className="progress-dots">
        {puzzles.map((_, i) => (
          <span key={i} className={i < idx ? 'done' : i === idx ? 'current' : ''} />
        ))}
      </div>

      <div className="ferry-title">
        <h3>{p.title}</h3>
        <Rules p={p} />
      </div>

      {guided && (
        <div className="explain ferry-explain">
          {hint ? (
            <>
              <strong>Hint</strong>
              {hint.text} The characters to take are marked with a yellow diamond.
            </>
          ) : review ? (
            <>
              <strong>Retry round · not scored</strong>
              {lastTry(review[idx])} Aim for a perfect crossing: the fewest trips and nobody lost. Stuck? Press Hint.
            </>
          ) : idx === 0 ? (
            <>
              <strong>How this works</strong>
              The sailor rows and protects the bank he is on. Before every trip, check the bank you are leaving: who would be alone together?
              Stuck? Press Hint to see the best next trip.
            </>
          ) : (
            <>
              <strong>No sailor this time</strong>
              Someone on board has to row, and the rules now apply everywhere: on the bank you leave, on the raft, and on the bank you arrive
              at. The hardest puzzles in the real test work like this.
            </>
          )}
        </div>
      )}

      <div className="river-scene">
        <FerryScene
          key={idx}
          puzzle={p}
          st={st}
          load={load}
          sailing={sailing}
          boatSide={boatShown as 0 | 1}
          eaten={eaten ? { pair: [eaten.by, eaten.victim], vanish: eaten.vanish } : null}
          celebrate={!!banner?.ok}
          busy={busy}
          hinted={hint?.load ?? []}
          onPick={toggle}
          onSail={sail}
        />

        {toast && <div className="ferry-toast">{toast}</div>}

        {eaten && (
          <div className="overlay overlay-bad overlay-delayed">
            <div className="overlay-card">
              <h3>Oh no!</h3>
              <p>{eatenText}</p>
              {practice && <p className="small">Everyone goes back to the start. Look at who was left together on that trip.</p>}
              <button className="btn btn-primary" onClick={retry}>
                <RetryIcon size={16} /> Try again
              </button>
            </div>
          </div>
        )}
        {banner && (
          <div className={`overlay ${banner.ok ? 'overlay-ok' : 'overlay-bad'} overlay-delayed`}>
            <div className="overlay-card">
              <h3>{banner.title}</h3>
              <p>{banner.text}</p>
            </div>
          </div>
        )}
        <div className="scene-tip">Drag to look around · scroll to zoom</div>
      </div>

      <div className="ferry-actions">
        <p className="muted small">
          Click a character on the raft's side to board them, and click them again to get off. Click the raft (or the button) to sail.
          Passengers stay on board until you click them off.
          {sailor ? ' The sailor can also cross alone.' : ' Without a sailor, someone who can row must be on board.'}
        </p>
        <button className="btn btn-primary btn-lg accent-btn" onClick={sail} disabled={busy}>
          {boatShown === 0 ? 'Sail across' : 'Sail back'}
        </button>
      </div>
    </div>
  );
}

/* ---------- Analysis ---------- */

function practiceResult(recs: Rec[], hints: number): GameResult {
  const solved = recs.filter((r) => r.solved).length;
  return {
    score: 0,
    metrics: [
      { label: 'Puzzles solved', value: `${solved}/${recs.length}` },
      { label: 'Hints used', value: String(hints) },
      { label: 'Passengers lost', value: String(sum(recs.map((r) => r.failures))) },
    ],
    strengths: [],
    improvements: [
      "The real test has 8 puzzles that get harder: wolves that count, a bear that takes two seats, a sheepdog that guards, and the police-and-thief puzzles. There are no hints, and the fewest possible trips stay hidden until you finish each puzzle. Afterwards you can retry the ones you didn't solve perfectly.",
    ],
  };
}

/** Offers the puzzles that still aren't perfect for another, unscored round. */
function retryOffer(recs: Rec[], again = false): GameResult['retry'] {
  const left = recs.filter((r) => !isPerfect(r));
  if (!left.length) return undefined;
  const what = `${left.length} puzzle${left.length > 1 ? 's' : ''}`;
  return { label: again ? `Retry the ${what} still not perfect` : `Retry the ${what} you didn't solve perfectly`, items: left };
}

function retryResult(recs: Rec[], hints: number): GameResult {
  const perfect = recs.filter(isPerfect).length;
  const left = recs.length - perfect;
  return {
    score: 0,
    metrics: [
      { label: 'Now perfect', value: `${perfect}/${recs.length}` },
      { label: 'Puzzles solved', value: `${recs.filter((r) => r.solved).length}/${recs.length}` },
      { label: 'Hints used', value: String(hints) },
      { label: 'Passengers lost', value: String(sum(recs.map((r) => r.failures))) },
    ],
    strengths: [],
    improvements: [
      left
        ? `${left} still not perfect. Before each trip, check who is left together, and remember that taking a passenger back is often the key move.`
        : 'Every puzzle perfect this time. In your next test, try to see the whole crossing like this before your first trip.',
    ],
    retry: retryOffer(recs, true),
  };
}

function analyse(recs: Rec[]): GameResult {
  const n = recs.length;
  const effOf = (r: Rec) => (r.solved ? Math.min(1, r.min / r.crossings) : 0);
  const eff = mean(recs.map(effOf));
  const solved = recs.filter((r) => r.solved).length;
  const perfect = recs.filter(isPerfect).length;
  const clean = recs.filter((r) => r.solved && r.failures === 0).length;
  const totalFailures = sum(recs.map((r) => r.failures));
  const avgPlan = mean(recs.map((r) => r.planMs));
  const avgTotal = mean(recs.map((r) => r.totalMs));
  const extra = sum(recs.filter((r) => r.solved).map((r) => r.crossings - r.min));

  const score = Math.round(eff * 75 + (clean / n) * 25);
  const deliberate = avgPlan >= 7000;
  const efficient = eff >= 0.8 && totalFailures <= 2;

  const profile = deliberate
    ? efficient
      ? { name: 'Strategic Planner', description: 'You think the whole crossing through before the boat leaves, and it pays off. Few wasted trips and few accidents.' }
      : { name: 'Careful Analyst', description: 'You take time to think before acting, but the plan does not always cover every danger. Your thinking time is there; make it more systematic by checking what is left behind on every trip.' }
    : efficient
      ? { name: 'Intuitive Solver', description: 'You move quickly and still find efficient crossings. You seem to grasp the structure of a problem fast and trust your read.' }
      : { name: 'Trial-and-Error Explorer', description: 'You learn by doing. You start sailing quickly and discover the rules through mistakes, which works eventually but costs extra trips and a few eaten passengers.' };

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (solved === n) strengths.push(`You got everyone across in all ${n} puzzles.`);
  if (perfect >= n / 2) strengths.push(`${perfect} perfect crossings: minimum trips and no accidents.`);
  if (totalFailures === 0) strengths.push('Not a single passenger was lost. You checked what you left behind every time.');
  if (eff >= 0.85) strengths.push(`High efficiency: you used only ${extra} extra trips across all solved puzzles.`);
  if (deliberate && efficient) strengths.push('Your planning time up front clearly paid off.');
  const expert = recs.slice(-2).filter((r) => r.solved).length;
  if (expert === 2) strengths.push('You cracked both expert puzzles. Those are the kind used in real IQ-style tests.');

  if (totalFailures >= 3)
    improvements.push(`${totalFailures} attempts ended badly. Before each trip, look at every group that will be alone (the bank you leave, and without a sailor also the raft and the bank you arrive at) and ask: "Who is left together?"`);
  if (eff < 0.75)
    improvements.push('You used quite a few extra trips. Remember that you can bring a passenger back. Temporarily returning the "dangerous" one is often the key move.');
  if (!deliberate && !efficient)
    improvements.push(`You set sail after ${secs(avgPlan)} on average. Try mentally playing out the first 3 trips before you start, and the accidents will drop.`);
  if (solved < n) improvements.push(`${n - solved} puzzle(s) were skipped. When stuck, work out which character is the "troublemaker" that can't be left with anyone, and plan around it.`);
  if (deliberate && !efficient)
    improvements.push('Break the puzzle into stages: first, which passenger can safely go alone? Then what must come back so the next one can go?');

  if (!strengths.length) strengths.push('You kept at every puzzle. Persistence is the foundation of problem solving.');
  if (!improvements.length) improvements.push('Very little to improve. Challenge yourself to plan every trip before your first crossing.');

  return {
    score,
    profile,
    metrics: [
      { label: 'Puzzles solved', value: `${solved}/${n}` },
      { label: 'Perfect crossings', value: `${perfect}/${n}`, hint: 'Minimum trips, no accidents' },
      { label: 'Trip efficiency', value: pct(eff), hint: 'Minimum trips ÷ trips you used' },
      { label: 'Failed attempts', value: String(totalFailures), hint: 'Someone eaten or robbed' },
      { label: 'Planning time', value: secs(avgPlan), hint: 'Before your first trip' },
      { label: 'Time per puzzle', value: secs(avgTotal) },
    ],
    strengths,
    improvements,
    chart: {
      title: 'Trip efficiency per puzzle',
      max: 100,
      note: 'Puzzles go from warm-up to expert. 100% means you used the minimum number of trips (failed attempts count too).',
      bars: recs.map((r) => ({
        label: r.title,
        value: effOf(r) * 100,
        display: r.solved ? `${r.crossings} trips · min ${r.min}` : `Skipped · min ${r.min}`,
      })),
    },
    retry: retryOffer(recs),
  };
}
