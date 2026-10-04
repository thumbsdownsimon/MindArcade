import { useEffect, useRef, useState } from 'react';
import type { GameProps, GameResult } from '../../lib/types';
import { mean, pick, scale, shuffle, pct, secs } from '../../lib/util';
import { useKeyDown, useTimeouts } from '../../lib/hooks';
import { ArrowLeft, ArrowRight } from '../../components/Icons';
import './racer.css';

const LANES = 4;
const PHASE_MS = 10_000;
const PHASES = 10;
const TOTAL_MS = PHASE_MS * PHASES;
const TOP_SPEED = 200;
const OTHER_SPEEDS = [80, 105, 125, 145, 160];
const CHANGE_MS = 350;
const MAX_GAUGE = 240;

/** speeds[phase][lane] in km/h. The fastest lane always moves to a different lane at each phase. */
function buildSpeeds(): number[][] {
  const out: number[][] = [];
  let fast = -1;
  for (let p = 0; p < PHASES; p++) {
    fast = pick([0, 1, 2, 3].filter((l) => l !== fast));
    const others = shuffle(OTHER_SPEEDS).slice(0, LANES - 1);
    out.push(Array.from({ length: LANES }, (_, l) => (l === fast ? TOP_SPEED : others.pop()!)));
  }
  return out;
}

interface Stats {
  /** ms from phase start until the player first sits in that phase's fastest lane (null = never) */
  findMs: (number | null)[];
  /** ms spent in the fastest lane per phase */
  inBestMs: number[];
  /** lanes visited before finding the fastest one, per phase */
  probes: number[];
  changes: number;
  /** left the fastest lane while it was still fastest */
  abandoned: number;
  distance: number;
  optimal: number;
}

function Speedometer({ speed }: { speed: number }) {
  const angle = -120 + (Math.min(speed, MAX_GAUGE) / MAX_GAUGE) * 240;
  const ticks = Array.from({ length: 13 }, (_, i) => i * 20);
  return (
    <div className="speedo">
      <svg viewBox="0 0 200 170" width="100%">
        <defs>
          <linearGradient id="speedArc" x1="0" x2="1">
            <stop offset="0" stopColor="#22c55e" />
            <stop offset=".6" stopColor="#eab308" />
            <stop offset="1" stopColor="#ef4444" />
          </linearGradient>
        </defs>
        <path d="M 30.7 140 A 80 80 0 1 1 169.3 140" fill="none" stroke="var(--surface-2)" strokeWidth="14" strokeLinecap="round" />
        <path d="M 30.7 140 A 80 80 0 1 1 169.3 140" fill="none" stroke="url(#speedArc)" strokeWidth="14" strokeLinecap="round"
          pathLength={100} strokeDasharray={`${(Math.min(speed, MAX_GAUGE) / MAX_GAUGE) * 100} 100`} />
        {ticks.map((t) => {
          const a = ((-120 + (t / MAX_GAUGE) * 240 - 90) * Math.PI) / 180;
          return (
            <g key={t}>
              <line x1={100 + Math.cos(a) * 62} y1={100 + Math.sin(a) * 62} x2={100 + Math.cos(a) * 68} y2={100 + Math.sin(a) * 68}
                stroke="var(--muted)" strokeWidth={t % 40 === 0 ? 2.5 : 1} />
              {t % 40 === 0 && (
                <text x={100 + Math.cos(a) * 50} y={100 + Math.sin(a) * 50 + 4} textAnchor="middle" fontSize="10" fill="var(--muted)" fontWeight="600">
                  {t}
                </text>
              )}
            </g>
          );
        })}
        <g transform={`rotate(${angle} 100 100)`}>
          <path d="M 97 100 L 100 34 L 103 100 Z" fill="#ef4444" />
        </g>
        <circle cx="100" cy="100" r="8" fill="var(--text)" />
        <text x="100" y="140" textAnchor="middle" fontSize="30" fontWeight="800" fill="var(--text)">
          {Math.round(speed)}
        </text>
        <text x="100" y="158" textAnchor="middle" fontSize="11" fill="var(--muted)" fontWeight="600">
          km/h
        </text>
      </svg>
    </div>
  );
}

export default function RacerGame({ onFinish }: GameProps) {
  const [speeds] = useState(buildSpeeds);
  const [started, setStarted] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const later = useTimeouts();
  const [lane, setLane] = useState(() => pick([1, 2]));
  const [view, setView] = useState({ speed: 0, distance: 0, elapsed: 0 });
  const laneRef = useRef(lane);
  const changeAt = useRef(-Infinity);
  const sim = useRef({ speed: 0, distance: 0, elapsed: 0, road: 0 });
  const stats = useRef<Stats>({
    findMs: Array(PHASES).fill(null),
    inBestMs: Array(PHASES).fill(0),
    probes: Array(PHASES).fill(0),
    changes: 0,
    abandoned: 0,
    distance: 0,
    optimal: 0,
  });
  const visited = useRef<Set<number>>(new Set());
  const roadRef = useRef<HTMLDivElement>(null);
  const finished = useRef(false);

  const phaseOf = (t: number) => Math.min(PHASES - 1, Math.floor(t / PHASE_MS));

  function changeLane(to: number) {
    if (!started || finished.current) return;
    to = Math.max(0, Math.min(LANES - 1, to));
    const from = laneRef.current;
    if (to === from) return;
    const ph = phaseOf(sim.current.elapsed);
    const best = speeds[ph].indexOf(TOP_SPEED);
    if (from === best) stats.current.abandoned++;
    stats.current.changes++;
    laneRef.current = to;
    changeAt.current = performance.now();
    setLane(to);
  }

  useKeyDown((e) => {
    if (!started && count === null && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      setCount(3);
      return;
    }
    if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') changeLane(laneRef.current - 1);
    if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') changeLane(laneRef.current + 1);
    if (['1', '2', '3', '4'].includes(e.key)) changeLane(Number(e.key) - 1);
  });

  // 3-2-1-GO countdown before the race clock starts.
  useEffect(() => {
    if (count === null) return;
    if (count > 0) later(() => setCount(count - 1), 700);
    else {
      setStarted(true);
      later(() => setCount(null), 600);
    }
  }, [count]);

  useEffect(() => {
    if (!started) return;
    // Driven by the real clock (not animation frames), so the race always progresses
    // even if the browser throttles rendering. Large gaps are integrated in small steps.
    const startAt = performance.now();
    let lastPhase = -1;

    const step = (dt: number, now: number) => {
      const s = sim.current;
      s.elapsed += dt;
      const ph = phaseOf(s.elapsed);
      if (ph !== lastPhase) {
        lastPhase = ph;
        visited.current = new Set([laneRef.current]);
      }
      const laneSpeeds = speeds[ph];
      const best = laneSpeeds.indexOf(TOP_SPEED);
      const changing = now - changeAt.current < CHANGE_MS;
      const target = laneSpeeds[laneRef.current] * (changing ? 0.7 : 1);
      // Smooth acceleration / braking toward the lane's speed.
      s.speed += (target - s.speed) * (1 - Math.exp(-dt / 450));
      s.distance += (s.speed / 3600) * dt; // km/h * ms → metres
      stats.current.optimal += (TOP_SPEED / 3600) * dt;

      visited.current.add(laneRef.current);
      if (laneRef.current === best && !changing) {
        stats.current.inBestMs[ph] += dt;
        if (stats.current.findMs[ph] === null) {
          stats.current.findMs[ph] = s.elapsed - ph * PHASE_MS;
          stats.current.probes[ph] = visited.current.size - 1;
        }
      }
      s.road = (s.road + s.speed * dt * 0.004) % 160;
    };

    const iv = window.setInterval(() => {
      const now = performance.now();
      const s = sim.current;
      let gap = Math.min(TOTAL_MS, now - startAt) - s.elapsed;
      while (gap > 0) {
        const dt = Math.min(gap, 40);
        step(dt, now);
        gap -= dt;
      }
      if (roadRef.current) roadRef.current.style.setProperty('--road', `${s.road}px`);
      setView({ speed: s.speed, distance: s.distance, elapsed: s.elapsed });

      if (s.elapsed >= TOTAL_MS && !finished.current) {
        finished.current = true;
        clearInterval(iv);
        stats.current.distance = s.distance;
        onFinish(analyse(stats.current));
      }
    }, 30);
    return () => clearInterval(iv);
  }, [started]);

  const remaining = Math.max(0, TOTAL_MS - view.elapsed);

  return (
    <div className="stage racer-stage">
      <div className="hud">
        <div className="hud-group">
          <span className="pill">
            Time left <strong>{Math.ceil(remaining / 1000)}s</strong>
          </span>
          <span className="pill pill-accent">
            Distance <strong>{(view.distance / 1000).toFixed(2)} km</strong>
          </span>
        </div>
        <div className="progress-bar" style={{ maxWidth: 260 }}>
          <span style={{ width: `${(view.elapsed / TOTAL_MS) * 100}%` }} />
        </div>
      </div>

      <div className="racer-layout">
        <div className="racer-road" ref={roadRef}>
          <div className="verge left" />
          <div className="verge right" />
          <div className="lanes">
            {Array.from({ length: LANES }, (_, l) => (
              <button
                key={l}
                className={`lane ${l === lane ? 'is-current' : ''}`}
                onClick={() => changeLane(l)}
                aria-label={`Lane ${l + 1}`}
              >
                <span className="lane-num">{l + 1}</span>
              </button>
            ))}
            {Array.from({ length: LANES - 1 }, (_, i) => (
              <div key={i} className="lane-line" style={{ left: `${((i + 1) / LANES) * 100}%` }} />
            ))}
            <div className="player-car" style={{ left: `${((lane + 0.5) / LANES) * 100}%` }}>
              <svg viewBox="0 0 40 70" width="40" height="70" aria-hidden="true">
                <rect x="1" y="12" width="6" height="14" rx="2" fill="#111827" />
                <rect x="33" y="12" width="6" height="14" rx="2" fill="#111827" />
                <rect x="1" y="46" width="6" height="14" rx="2" fill="#111827" />
                <rect x="33" y="46" width="6" height="14" rx="2" fill="#111827" />
                <path d="M8 10 Q20 0 32 10 L34 60 Q20 70 6 60 Z" fill="#e11d48" />
                <rect x="11" y="18" width="18" height="12" rx="3" fill="#0f172a" opacity=".7" />
                <rect x="12" y="48" width="16" height="7" rx="2" fill="#0f172a" opacity=".55" />
                <rect x="18" y="4" width="4" height="58" fill="#fff" opacity=".85" />
              </svg>
            </div>
          </div>

          {count !== null && (
            <div className="countdown" key={count}>
              {count > 0 ? count : 'GO!'}
            </div>
          )}

          {!started && count === null && (
            <div className="overlay">
              <div className="overlay-card">
                <span className="eyebrow">Ready?</span>
                <h3>Find the fastest lane</h3>
                <p>
                  Each lane has a hidden speed limit, and you only see your own speedometer. The fastest lane moves every so
                  often, so keep an eye on your speed and change lanes when it drops.
                </p>
                <button className="btn btn-primary" onClick={() => setCount(3)}>
                  Start engine
                </button>
                <p className="muted small">or press Space</p>
              </div>
            </div>
          )}
        </div>

        <div className="racer-side">
          <div className="card-inset speedo-card">
            <Speedometer speed={view.speed} />
            <div className="speedo-sub">
              Lane <strong>{lane + 1}</strong>
            </div>
          </div>
          <div className="racer-controls">
            <button className="btn btn-secondary btn-lg" onClick={() => changeLane(lane - 1)} disabled={!started || lane === 0}>
              <ArrowLeft /> Left
            </button>
            <button className="btn btn-secondary btn-lg" onClick={() => changeLane(lane + 1)} disabled={!started || lane === LANES - 1}>
              Right <ArrowRight />
            </button>
          </div>
          <p className="muted small center">
            Click a lane, use ← / →, or press 1–4. Changing lanes briefly costs some speed.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------- Analysis ---------- */

function analyse(s: Stats): GameResult {
  const ratio = s.distance / s.optimal;
  const inBest = s.inBestMs.reduce((a, b) => a + b, 0) / TOTAL_MS;
  // Adaptation: phases 2..N (phase 1 is initial discovery). Never found = whole phase.
  const adapt = s.findMs.slice(1).map((m) => m ?? PHASE_MS);
  const avgAdapt = mean(adapt);
  const missed = s.findMs.filter((m) => m === null).length;
  const avgProbes = mean(s.probes.filter((_, i) => s.findMs[i] !== null));
  const changesPerPhase = s.changes / PHASES;

  const score = Math.round(100 * (0.6 * scale(ratio, 0.6, 0.95) + 0.4 * scale(avgAdapt, 8000, 1800)));

  const quick = avgAdapt <= 3500;
  const restless = changesPerPhase > 4 || s.abandoned >= 4;
  const profile = quick && !restless
    ? { name: 'Agile Adapter', description: 'You notice quickly when things change and find the new best option with little wasted effort. That is cognitive flexibility at its best.' }
    : quick && restless
      ? { name: 'Restless Explorer', description: 'You adapt fast, but you also keep switching when there is no need. Your flexibility is strong; channel it so you exploit a good lane once you have it.' }
      : missed >= 3
        ? { name: 'Steady Cruiser', description: 'You tend to stay put. That is stable, but you often keep driving in a lane long after it has stopped being the fastest.' }
        : { name: 'Deliberate Adapter', description: 'You do adapt to changes, but it takes a while to notice the drop and search for the new fastest lane.' };

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (ratio >= 0.85) strengths.push(`You drove ${pct(ratio)} of the maximum possible distance.`);
  if (quick) strengths.push(`Fast adaptation: on average you found the new fastest lane within ${secs(avgAdapt)} of a change.`);
  if (avgProbes <= 1.5 && missed < PHASES) strengths.push(`Efficient searching: you needed to check only ${avgProbes.toFixed(1)} lanes on average to find the fastest.`);
  if (s.abandoned <= 1) strengths.push("Once you found the fastest lane, you stayed in it. No needless lane changes.");
  if (missed === 0) strengths.push('You found the fastest lane in every single stretch.');

  if (avgAdapt > 4000)
    improvements.push(`It took you ${secs(avgAdapt)} on average to reach the new fastest lane after it moved. Watch the speedometer: the moment the needle drops, start searching instead of waiting.`);
  if (missed >= 2) improvements.push(`In ${missed} of ${PHASES} stretches you never found the fastest lane. Try a systematic sweep (check each lane briefly) rather than guessing.`);
  if (s.abandoned >= 3)
    improvements.push(`You left the fastest lane ${s.abandoned} times while it was still the fastest. If your speed is at its peak, there is no better lane, so stay and exploit it.`);
  if (avgProbes > 2) improvements.push('You tried many lanes before finding the best one. Remember that the slow lanes you just checked are unlikely to be the answer, so head to the ones you haven\'t tried.');
  if (ratio < 0.75) improvements.push('Total distance was on the low side. The fastest lane is clearly faster (200 km/h), so if you are below that, you are not in it yet.');

  if (!strengths.length) strengths.push('You completed the full 100-second race and kept adjusting to changing conditions.');
  if (!improvements.length) improvements.push('Excellent flexibility. To push further, try reacting within 2 seconds of a speed drop.');

  return {
    score,
    profile,
    metrics: [
      { label: 'Distance', value: `${(s.distance / 1000).toFixed(2)} km`, hint: `Max possible ${(s.optimal / 1000).toFixed(2)} km` },
      { label: 'Distance efficiency', value: pct(ratio) },
      { label: 'Time to adapt', value: secs(avgAdapt), hint: 'Avg time to find the new fastest lane' },
      { label: 'Time in fastest lane', value: pct(inBest) },
      { label: 'Lane changes', value: String(s.changes), hint: `${s.abandoned} times you left the fastest lane` },
      { label: 'Stretches missed', value: `${missed} / ${PHASES}`, hint: 'Never found the fastest lane' },
    ],
    strengths,
    improvements,
    chart: {
      title: 'Time to find the fastest lane, per 10-second stretch',
      max: PHASE_MS / 1000,
      note: 'Shorter is better. Stretch 1 is your initial search; after that the fastest lane moves every 10 seconds.',
      bars: s.findMs.map((m, i) => ({
        label: `Stretch ${i + 1}`,
        value: (m ?? PHASE_MS) / 1000,
        display: m === null ? 'Not found' : secs(m),
      })),
    },
  };
}
