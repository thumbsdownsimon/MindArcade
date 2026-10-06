import { useMemo, useRef, useState } from 'react';
import type { GameProps, GameResult } from '../../lib/types';
import { mean, sum, pct, secs } from '../../lib/util';
import { useTimeouts } from '../../lib/hooks';
import { RetryIcon } from '../../components/Icons';
import { EATS, LABEL, boatProblem, conflict, cross, leftBehind, minCrossings, type Kind, type Puzzle, type State } from './engine';
import { flatParts, snapshot } from '../../three/voxel';
import FerryScene, { SAIL_MS, lookFor } from './FerryScene';
import './ferry.css';

const PUZZLES: Puzzle[] = [
  { title: 'The classic crossing', kinds: ['fox', 'chicken', 'larva'], capacity: 1 },
  { title: 'Family trip', kinds: ['adult', 'adult', 'kid', 'kid', 'kid', 'kid'], capacity: 2 },
  { title: 'Double larva', kinds: ['fox', 'chicken', 'larva', 'larva'], capacity: 2 },
  { title: 'Enter the black fox', kinds: ['blackfox', 'fox', 'chicken', 'larva'], capacity: 2 },
  { title: 'Crowded farm', kinds: ['fox', 'fox', 'chicken', 'chicken', 'larva'], capacity: 2 },
  { title: 'One parent, four kids', kinds: ['adult', 'kid', 'kid', 'kid', 'kid'], capacity: 2 },
  { title: 'Black fox & friends', kinds: ['blackfox', 'fox', 'chicken', 'larva', 'larva'], capacity: 3 },
  { title: 'School outing', kinds: ['adult', 'adult', 'adult', 'kid', 'kid', 'kid'], capacity: 2 },
];


interface Rec {
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

function Rules({ p }: { p: Puzzle }) {
  const present = new Set(p.kinds);
  const pairs = (Object.keys(EATS) as Kind[])
    .filter((k) => present.has(k))
    .flatMap((k) => EATS[k]!.filter((v) => present.has(v)).map((v) => [k, v] as const));
  return (
    <div className="rules">
      <span className="rule-chip">Sailor + {p.capacity} seat{p.capacity > 1 ? 's' : ''}</span>
      {present.has('kid') && (
        <span className="rule-chip warn">
          <Portrait kind="kid" /> A kid can never travel as the only passenger
        </span>
      )}
      {pairs.map(([a, b]) => (
        <span key={a + b} className="rule-chip warn">
          <Portrait kind={a} /> {LABEL[a]} eats <Portrait kind={b} /> {LABEL[b].toLowerCase()}
        </span>
      ))}
    </div>
  );
}

export default function FerryGame({ onFinish }: GameProps) {
  const [mins] = useState(() => PUZZLES.map((p) => minCrossings(p) ?? 99));
  const [idx, setIdx] = useState(0);
  const p = PUZZLES[idx];
  const fresh = (pz: Puzzle): State => ({ side: pz.kinds.map(() => 0), boat: 0 });
  const [st, setSt] = useState<State>(() => fresh(PUZZLES[0]));
  const [load, setLoad] = useState<number[]>([]);
  const [sailing, setSailing] = useState(false);
  const [crossings, setCrossings] = useState(0);
  const [failures, setFailures] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [eaten, setEaten] = useState<{ pair: [number, number]; text: string } | null>(null);
  const [banner, setBanner] = useState<{ ok: boolean; title: string; text: string } | null>(null);
  const t0 = useRef(performance.now());
  const firstSail = useRef<number | null>(null);
  const recs = useRef<Rec[]>([]);
  const later = useTimeouts();

  const busy = sailing || !!eaten || !!banner;
  const boatShown = sailing ? 1 - st.boat : st.boat;

  function say(msg: string) {
    setToast(msg);
    later(() => setToast((t) => (t === msg ? null : t)), 2200);
  }

  function toggle(i: number) {
    if (busy) return;
    if (load.includes(i)) return setLoad(load.filter((x) => x !== i));
    if (st.side[i] !== st.boat) return say('The boat is on the other side of the river.');
    if (load.length >= p.capacity) return say(`The boat only has ${p.capacity} seat${p.capacity > 1 ? 's' : ''}.`);
    setLoad([...load, i]);
  }

  function sail() {
    if (busy) return;
    const problem = boatProblem(p, load);
    if (problem) return say(problem);
    if (firstSail.current === null) firstSail.current = performance.now();
    const danger = conflict(p.kinds, leftBehind(st, load));
    const used = crossings + 1;
    setCrossings(used);
    setSailing(true);
    later(() => {
      if (danger) {
        const [a, b] = danger;
        setEaten({ pair: [a, b], text: `While the sailor was away, the ${LABEL[p.kinds[a]].toLowerCase()} ate the ${LABEL[p.kinds[b]].toLowerCase()}!` });
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
  }

  function complete(solved: boolean, used: number) {
    const now = performance.now();
    const min = mins[idx];
    recs.current.push({
      min,
      crossings: used,
      failures,
      solved,
      planMs: (firstSail.current ?? now) - t0.current,
      totalMs: now - t0.current,
    });
    setBanner(
      solved
        ? used === min && failures === 0
          ? { ok: true, title: 'Perfect crossing!', text: `Everyone made it across in the minimum ${min} trips.` }
          : { ok: true, title: 'Everyone made it!', text: `${used} trips in total. The fewest possible is ${min}.` }
        : { ok: false, title: 'Puzzle skipped', text: `This one can be done in ${min} trips.` },
    );
    later(() => {
      if (idx + 1 >= PUZZLES.length) return onFinish(analyse(recs.current));
      const n = idx + 1;
      setIdx(n);
      setSt(fresh(PUZZLES[n]));
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

  const bank = (side: 0 | 1) =>
    p.kinds.map((k, i) => ({ k, i })).filter(({ i }) => st.side[i] === side && !load.includes(i));

  return (
    <div className="stage ferry-stage">
      <div className="hud">
        <div className="hud-group">
          <span className="pill">
            Puzzle {idx + 1} / {PUZZLES.length}
          </span>
          <span className="pill">
            Trips <strong>{crossings}</strong>
          </span>
          <span className="pill pill-accent">Best possible: {mins[idx]}</span>
          {failures > 0 && <span className="pill pill-bad">Failed attempts: {failures}</span>}
        </div>
        <div className="hud-group">
          <button className="btn btn-secondary btn-sm" onClick={restart} disabled={busy}>
            <RetryIcon size={16} /> Restart
          </button>
          <button className="btn btn-ghost btn-sm" onClick={() => !busy && complete(false, crossings)} disabled={busy}>
            Skip
          </button>
        </div>
      </div>
      <div className="progress-dots">
        {PUZZLES.map((_, i) => (
          <span key={i} className={i < idx ? 'done' : i === idx ? 'current' : ''} />
        ))}
      </div>

      <div className="ferry-title">
        <h3>{p.title}</h3>
        <Rules p={p} />
      </div>

      <div className="river-scene">
        <FerryScene
          key={idx}
          puzzle={p}
          st={st}
          load={load}
          sailing={sailing}
          boatSide={boatShown as 0 | 1}
          eaten={eaten?.pair ?? null}
          celebrate={!!banner?.ok}
          busy={busy}
          onPick={toggle}
          onSail={sail}
        />

        {toast && <div className="ferry-toast">{toast}</div>}

        {eaten && (
          <div className="overlay overlay-bad overlay-delayed">
            <div className="overlay-card">
              <h3>Oh no!</h3>
              <p>{eaten.text}</p>
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
          Click a character on the boat's side to board them, and click them again to get off. Click the sailor or the raft (or the button) to sail. Passengers stay on board until you
          click them off. The sailor can also cross alone.
        </p>
        <button className="btn btn-primary btn-lg accent-btn" onClick={sail} disabled={busy}>
          {boatShown === 0 ? 'Sail across' : 'Sail back'}
        </button>
      </div>
    </div>
  );
}

/* ---------- Analysis ---------- */

function analyse(recs: Rec[]): GameResult {
  const n = recs.length;
  const effOf = (r: Rec) => (r.solved ? Math.min(1, r.min / r.crossings) : 0);
  const eff = mean(recs.map(effOf));
  const solved = recs.filter((r) => r.solved).length;
  const perfect = recs.filter((r) => r.solved && r.crossings === r.min && r.failures === 0).length;
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
  if (totalFailures === 0) strengths.push('Not a single passenger was eaten. You checked what you left behind every time.');
  if (eff >= 0.85) strengths.push(`High efficiency: you used only ${extra} extra trips across all solved puzzles.`);
  if (deliberate && efficient) strengths.push('Your planning time up front clearly paid off.');

  if (totalFailures >= 3)
    improvements.push(`${totalFailures} attempts ended with someone being eaten. Before each trip, look at the bank you are leaving and ask: "Who is left alone together?"`);
  if (eff < 0.75)
    improvements.push('You used quite a few extra trips. Remember that you can bring a passenger back. Temporarily returning the "dangerous" one is often the key move.');
  if (!deliberate && !efficient)
    improvements.push(`You set sail after ${secs(avgPlan)} on average. Try mentally playing out the first 3 trips before you start, and the accidents will drop.`);
  if (solved < n) improvements.push(`${n - solved} puzzle(s) were skipped. When stuck, work out which passenger is the "troublemaker" that can't be left with anyone, and plan around it.`);
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
      { label: 'Passengers eaten', value: String(totalFailures), hint: 'Failed attempts' },
      { label: 'Planning time', value: secs(avgPlan), hint: 'Before your first trip' },
      { label: 'Time per puzzle', value: secs(avgTotal) },
    ],
    strengths,
    improvements,
    chart: {
      title: 'Trip efficiency per puzzle',
      max: 100,
      note: '100% means you used the minimum number of trips (failed attempts count too).',
      bars: recs.map((r, i) => ({
        label: PUZZLES[i].title,
        value: effOf(r) * 100,
        display: r.solved ? `${r.crossings} trips · min ${r.min}` : `Skipped · min ${r.min}`,
      })),
    },
  };
}
