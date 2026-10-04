import { useEffect, useRef, useState } from 'react';
import type { GameProps, GameResult } from '../../lib/types';
import { mean, pick, shuffle, pct, secs } from '../../lib/util';
import { useTimeouts } from '../../lib/hooks';
import './fish.css';

type FColor = 'orange' | 'purple' | 'blue' | 'yellow';
type Pattern = 'stripes' | 'spots' | 'plain';
type QType = 'where' | 'forward' | 'reverse' | 'most' | 'total' | 'last';

interface Group {
  spot: number;
  color: FColor;
  pattern: Pattern;
  count: number;
}

interface Round {
  len: number;
  type: QType;
  seq: Group[];
  /** for 'where': index into seq of the asked-about group */
  focus?: number;
  /** for 'last': option indices into seq; for 'total': numeric options */
  options?: number[];
}

interface Rec {
  type: QType;
  len: number;
  credit: number;
  rt: number;
}

const SPOTS = [
  { x: 18, y: 28 }, { x: 37, y: 18 }, // north-west
  { x: 63, y: 20 }, { x: 82, y: 30 }, // north-east
  { x: 20, y: 72 }, { x: 39, y: 82 }, // south-west
  { x: 61, y: 80 }, { x: 81, y: 70 }, // south-east
];
const AREAS = ['North-west', 'North-east', 'South-west', 'South-east'];
const areaOf = (spot: number) => Math.floor(spot / 2);

const PLAN: [number, QType][] = [
  [3, 'where'], [3, 'forward'], [4, 'most'], [4, 'total'], [5, 'where'],
  [5, 'reverse'], [6, 'last'], [6, 'most'], [7, 'reverse'], [7, 'where'],
];

const COLORS: Record<FColor, [string, string]> = {
  orange: ['#fb923c', '#c2410c'],
  purple: ['#a78bfa', '#6d28d9'],
  blue: ['#60a5fa', '#1d4ed8'],
  yellow: ['#facc15', '#a16207'],
};

const PROMPT: Record<QType, string> = {
  where: 'Where did this fish group appear?',
  forward: 'Tap the spots in the order the fish appeared.',
  reverse: 'Tap the spots in REVERSE order: last fish first.',
  most: 'Which area of the pond had the most fish in total?',
  total: 'How many fish appeared in total?',
  last: 'Which fish group appeared LAST?',
};

const sameLook = (a: Group, b: Group) => a.color === b.color && a.pattern === b.pattern;

function randomSeq(len: number): Group[] {
  const spots = shuffle([...SPOTS.keys()]).slice(0, len);
  return spots.map((spot) => ({
    spot,
    color: pick(['orange', 'purple', 'blue', 'yellow'] as const),
    pattern: pick(['stripes', 'spots', 'plain'] as const),
    count: pick([1, 1, 2, 2, 3]),
  }));
}

function buildRound(len: number, type: QType): Round {
  for (;;) {
    const seq = randomSeq(len);
    if (type === 'where') {
      const unique = seq.map((g, i) => i).filter((i) => seq.filter((g) => sameLook(g, seq[i])).length === 1);
      if (!unique.length) continue;
      return { len, type, seq, focus: pick(unique) };
    }
    if (type === 'most') {
      const totals = [0, 1, 2, 3].map((a) => seq.filter((g) => areaOf(g.spot) === a).reduce((s, g) => s + g.count, 0));
      const max = Math.max(...totals);
      if (totals.filter((t) => t === max).length !== 1) continue;
      return { len, type, seq };
    }
    if (type === 'total') {
      const total = seq.reduce((s, g) => s + g.count, 0);
      const opts = new Set([total]);
      while (opts.size < 4) opts.add(Math.max(1, total + pick([-3, -2, -1, 1, 2, 3])));
      return { len, type, seq, options: shuffle([...opts]) };
    }
    if (type === 'last') {
      const last = seq[len - 1];
      const others = seq
        .slice(0, -1)
        .map((g, i) => i)
        .filter((i) => !(sameLook(seq[i], last) && seq[i].count === last.count));
      if (others.length < 3) continue;
      return { len, type, seq, options: shuffle([len - 1, ...shuffle(others).slice(0, 3)]) };
    }
    return { len, type, seq };
  }
}

export function FishSvg({ color, pattern, size = 46, uid }: { color: FColor; pattern: Pattern; size?: number; uid: string }) {
  const [main, dark] = COLORS[color];
  const clip = `fc-${uid}`;
  return (
    <svg viewBox="0 0 120 80" width={size} height={size * (80 / 120)} aria-hidden="true" style={{ display: 'block' }}>
      <defs>
        <clipPath id={clip}>
          <ellipse cx="58" cy="42" rx="40" ry="24" />
        </clipPath>
      </defs>
      <path d="M22 42 L2 22 L8 42 L2 62 Z" fill={dark} />
      <path d="M40 22 Q56 0 74 22 Z" fill={dark} />
      <ellipse cx="58" cy="42" rx="40" ry="24" fill={main} />
      <g clipPath={`url(#${clip})`} fill={dark} opacity=".6">
        {pattern === 'stripes' && (
          <>
            <rect x="34" y="10" width="8" height="70" />
            <rect x="51" y="10" width="8" height="70" />
            <rect x="68" y="10" width="8" height="70" />
          </>
        )}
        {pattern === 'spots' && (
          <>
            <circle cx="40" cy="34" r="6" />
            <circle cx="55" cy="51" r="6" />
            <circle cx="68" cy="31" r="5" />
            <circle cx="42" cy="55" r="4" />
          </>
        )}
      </g>
      <ellipse cx="58" cy="42" rx="40" ry="24" fill="none" stroke={dark} strokeWidth="2.5" />
      <circle cx="84" cy="36" r="6" fill="#fff" />
      <circle cx="86" cy="36" r="3" fill="#0f172a" />
    </svg>
  );
}

function FishGroup({ g, size = 56, uid }: { g: Group; size?: number; uid: string }) {
  return (
    <span className={`fish-group n${g.count}`}>
      {Array.from({ length: g.count }, (_, i) => (
        <span key={i} className="fish-one">
          <FishSvg color={g.color} pattern={g.pattern} size={size} uid={`${uid}-${i}`} />
        </span>
      ))}
    </span>
  );
}

export default function FishGame({ onFinish }: GameProps) {
  const [rounds] = useState(() => PLAN.map(([l, t]) => buildRound(l, t)));
  const [ri, setRi] = useState(0);
  const [phase, setPhase] = useState<'intro' | 'ready' | 'show' | 'question' | 'feedback'>('intro');
  const [step, setStep] = useState(-1);
  const [taps, setTaps] = useState<number[]>([]);
  const [fb, setFb] = useState<{ credit: number; text: string; picked?: number } | null>(null);
  const qStart = useRef(0);
  const recs = useRef<Rec[]>([]);
  const later = useTimeouts();

  const round = rounds[ri];
  const showMs = ri < 4 ? 1800 : ri < 7 ? 1650 : 1500;

  useEffect(() => {
    if (phase === 'ready') later(() => { setStep(0); setPhase('show'); }, 1200);
    if (phase === 'show') {
      // Each group is visible for showMs, then a short gap (step + 0.5 = hidden).
      if (step >= round.len) {
        setPhase('question');
        qStart.current = performance.now();
        return;
      }
      if (Number.isInteger(step)) later(() => setStep(step + 0.5), showMs);
      else later(() => setStep(step + 0.5), 500);
    }
  }, [phase, step]);

  function record(credit: number, text: string, picked?: number) {
    recs.current.push({ type: round.type, len: round.len, credit, rt: performance.now() - qStart.current });
    setFb({ credit, text, picked });
    setPhase('feedback');
  }

  function answerSpot(spot: number) {
    if (phase !== 'question') return;
    if (round.type === 'where') {
      const ok = round.seq[round.focus!].spot === spot;
      return record(ok ? 1 : 0, ok ? 'Correct, that was the spot!' : 'Not quite. The correct spot is highlighted.', spot);
    }
    if (round.type === 'forward' || round.type === 'reverse') {
      if (taps.includes(spot)) return;
      const next = [...taps, spot];
      setTaps(next);
      if (next.length === round.len) {
        const order = round.seq.map((g) => g.spot);
        if (round.type === 'reverse') order.reverse();
        const right = next.filter((s, i) => s === order[i]).length;
        const credit = right / round.len;
        record(credit, credit === 1 ? 'Perfect order!' : `${right} of ${round.len} in the right position.`);
      }
    }
  }

  function answerArea(area: number) {
    if (phase !== 'question') return;
    const totals = [0, 1, 2, 3].map((a) => round.seq.filter((g) => areaOf(g.spot) === a).reduce((s, g) => s + g.count, 0));
    const best = totals.indexOf(Math.max(...totals));
    const ok = area === best;
    record(ok ? 1 : 0, ok ? `Correct, ${AREAS[best]} had ${totals[best]} fish.` : `It was ${AREAS[best]}, with ${totals[best]} fish.`, area);
  }

  function answerOption(v: number) {
    if (phase !== 'question') return;
    if (round.type === 'total') {
      const total = round.seq.reduce((s, g) => s + g.count, 0);
      record(v === total ? 1 : 0, v === total ? `Correct, ${total} fish.` : `There were ${total} fish.`, v);
    } else {
      const ok = v === round.len - 1;
      record(ok ? 1 : 0, ok ? 'Correct!' : 'Not that one. The last group is highlighted.', v);
    }
  }

  function next() {
    if (ri + 1 >= rounds.length) return onFinish(analyse(recs.current));
    setRi(ri + 1);
    setTaps([]);
    setFb(null);
    setStep(-1);
    setPhase('ready');
  }

  const visible = phase === 'show' && Number.isInteger(step) && step < round.len ? round.seq[step] : null;
  const reveal = phase === 'feedback';
  const spotClickable = phase === 'question' && ['where', 'forward', 'reverse'].includes(round.type);
  const areaClickable = phase === 'question' && round.type === 'most';
  const correctOrder = round.type === 'reverse' ? [...round.seq].reverse() : round.seq;

  return (
    <div className="stage fish-stage">
      <div className="hud">
        <div className="hud-group">
          <span className="pill">
            Round {ri + 1} / {rounds.length}
          </span>
          <span className="pill pill-accent">{round.len} fish groups</span>
        </div>
        <div className="progress-dots" style={{ flex: 1, maxWidth: 300, margin: 0 }}>
          {rounds.map((_, i) => (
            <span key={i} className={i < ri ? 'done' : i === ri ? 'current' : ''} />
          ))}
        </div>
      </div>

      <div className="pond-wrap">
        <div className="pond">
          <div className="pond-cross v" />
          <div className="pond-cross h" />
          {AREAS.map((a, i) => (
            <button
              key={a}
              className={['pond-area', `a${i}`, areaClickable && 'is-clickable', reveal && round.type === 'most' && fb?.picked === i && 'is-picked']
                .filter(Boolean)
                .join(' ')}
              onClick={() => answerArea(i)}
              disabled={!areaClickable}
            >
              <span className="area-label">{a}</span>
            </button>
          ))}

          {SPOTS.map((s, i) => {
            const tapIdx = taps.indexOf(i);
            const isAnswer =
              reveal &&
              ((round.type === 'where' && round.seq[round.focus!].spot === i) ||
                ((round.type === 'forward' || round.type === 'reverse') && round.seq.some((g) => g.spot === i)));
            const orderNum = correctOrder.findIndex((g) => g.spot === i) + 1;
            return (
              <button
                key={i}
                className={[
                  'lily',
                  spotClickable && 'is-clickable',
                  isAnswer && 'is-answer',
                  reveal && round.type === 'where' && fb?.picked === i && fb.credit === 0 && 'is-wrong',
                ]
                  .filter(Boolean)
                  .join(' ')}
                style={{ left: `${s.x}%`, top: `${s.y}%` }}
                onClick={() => answerSpot(i)}
                disabled={!spotClickable}
                aria-label={`Spot ${i + 1}`}
              >
                {tapIdx >= 0 && !reveal && <span className="tap-num">{tapIdx + 1}</span>}
                {reveal && isAnswer && (round.type === 'forward' || round.type === 'reverse') && (
                  <span className={`tap-num ${taps[orderNum - 1] === i ? 'ok' : 'bad'}`}>{orderNum}</span>
                )}
              </button>
            );
          })}

          {visible && (
            <div key={step} className="fish-appear" style={{ left: `${SPOTS[visible.spot].x}%`, top: `${SPOTS[visible.spot].y}%` }}>
              <FishGroup g={visible} uid={`show-${ri}-${step}`} />
            </div>
          )}

          {phase === 'ready' && <div className="pond-banner">Watch closely…</div>}

          {phase === 'intro' && (
            <div className="overlay">
              <div className="overlay-card">
                <span className="eyebrow">Memory pond</span>
                <h3>Remember the fish</h3>
                <p>
                  Groups of fish pop up one by one on the lily pads. Remember <strong>where</strong>, <strong>in which order</strong>,{' '}
                  <strong>how many</strong> and <strong>what they looked like</strong>. You won't know the question until the end.
                </p>
                <button className="btn btn-primary" onClick={() => setPhase('ready')}>
                  Start
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="question-panel">
          {phase === 'question' || phase === 'feedback' ? (
            <>
              <div className="q-label">Question</div>
              <h3 className="q-text">{PROMPT[round.type]}</h3>
              {round.type === 'where' && (
                <div className="q-fish">
                  <FishGroup g={round.seq[round.focus!]} size={56} uid={`q-${ri}`} />
                </div>
              )}
              {(round.type === 'forward' || round.type === 'reverse') && phase === 'question' && (
                <div className="q-progress">
                  <span>
                    {taps.length} / {round.len} tapped
                  </span>
                  <button className="btn btn-ghost btn-sm" onClick={() => setTaps(taps.slice(0, -1))} disabled={!taps.length}>
                    Undo
                  </button>
                </div>
              )}
              {round.type === 'total' && (
                <div className="q-options numbers">
                  {round.options!.map((v) => (
                    <button
                      key={v}
                      className={[
                        'btn btn-secondary btn-lg',
                        reveal && v === round.seq.reduce((s, g) => s + g.count, 0) && 'opt-correct',
                        reveal && fb?.picked === v && fb.credit === 0 && 'opt-wrong',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => answerOption(v)}
                      disabled={phase !== 'question'}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
              {round.type === 'last' && (
                <div className="q-options groups">
                  {round.options!.map((gi) => (
                    <button
                      key={gi}
                      className={[
                        'group-opt',
                        reveal && gi === round.len - 1 && 'opt-correct',
                        reveal && fb?.picked === gi && fb.credit === 0 && 'opt-wrong',
                      ]
                        .filter(Boolean)
                        .join(' ')}
                      onClick={() => answerOption(gi)}
                      disabled={phase !== 'question'}
                    >
                      <FishGroup g={round.seq[gi]} size={40} uid={`o-${ri}-${gi}`} />
                    </button>
                  ))}
                </div>
              )}
              {phase === 'question' && round.type === 'most' && <p className="muted small">Click an area of the pond.</p>}
              {phase === 'question' && (round.type === 'where' || round.type === 'forward' || round.type === 'reverse') && (
                <p className="muted small">Click the lily pads in the pond.</p>
              )}
              {fb && (
                <div className={`q-feedback ${fb.credit === 1 ? 'ok' : fb.credit > 0 ? 'mid' : 'bad'}`}>
                  <strong>{fb.credit === 1 ? '✓ ' : fb.credit > 0 ? '◐ ' : '✗ '}</strong>
                  {fb.text}
                </div>
              )}
              {phase === 'feedback' && (
                <button className="btn btn-primary btn-lg accent-btn" onClick={next}>
                  {ri + 1 >= rounds.length ? 'See results' : 'Next round'}
                </button>
              )}
            </>
          ) : (
            <div className="q-waiting">
              <div className="q-label">Round {ri + 1}</div>
              <h3 className="q-text">{phase === 'intro' ? 'Get ready' : 'Memorise the fish…'}</h3>
              <p className="muted small">
                Watch for position, order, colour, pattern and group size. The rounds get longer and faster as you go.
              </p>
              {phase === 'show' && (
                <div className="seq-dots">
                  {round.seq.map((_, i) => (
                    <span key={i} className={i < Math.ceil(step) ? 'on' : ''} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Analysis ---------- */

const CATS: Record<string, QType[]> = {
  Order: ['forward', 'reverse'],
  Location: ['where', 'most'],
  Detail: ['total', 'last'],
};

function analyse(recs: Rec[]): GameResult {
  const weight = recs.reduce((s, r) => s + r.len, 0);
  const score = Math.round((100 * recs.reduce((s, r) => s + r.credit * r.len, 0)) / weight);
  const full = recs.filter((r) => r.credit === 1);
  const span = full.length ? Math.max(...full.map((r) => r.len)) : 0;
  const catAcc = Object.fromEntries(
    Object.entries(CATS).map(([k, types]) => [k, mean(recs.filter((r) => types.includes(r.type)).map((r) => r.credit))]),
  ) as Record<string, number>;
  const shortAcc = mean(recs.filter((r) => r.len <= 4).map((r) => r.credit));
  const longAcc = mean(recs.filter((r) => r.len >= 6).map((r) => r.credit));
  const avgRt = mean(recs.map((r) => r.rt));
  const reverse = recs.filter((r) => r.type === 'reverse');
  const best = Object.entries(catAcc).sort((a, b) => b[1] - a[1])[0];
  const worst = Object.entries(catAcc).sort((a, b) => a[1] - b[1])[0];

  const profile =
    score >= 80
      ? { name: 'Sharp Memoriser', description: 'You hold a lot of information in mind at once and can work with it: reversing it, counting it and locating it. Your working memory is a real strength.' }
      : best[1] - worst[1] >= 0.3
        ? best[0] === 'Order'
          ? { name: 'Sequence Tracker', description: 'You are strongest at remembering the order of events. You naturally encode things as a timeline.' }
          : best[0] === 'Location'
            ? { name: 'Spatial Mapper', description: 'You are strongest at remembering where things happened. You build a mental map as you watch.' }
            : { name: 'Detail Spotter', description: 'You are strongest at the details: how many fish there were and what they looked like.' }
        : score >= 50
          ? { name: 'Balanced Learner', description: 'You perform evenly across order, location and detail questions, a solid all-round memory profile.' }
          : { name: 'Building Capacity', description: 'Holding many pieces of information at once is still demanding for you. Memory strategies like chunking and verbal labels can boost this quickly.' };

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (span >= 6) strengths.push(`You fully answered a question about a ${span}-group sequence. That is a strong memory span.`);
  if (catAcc.Order >= 0.8) strengths.push(`Excellent order memory (${pct(catAcc.Order)}), including the tough reverse-order questions.`);
  if (catAcc.Location >= 0.8) strengths.push(`Strong spatial memory (${pct(catAcc.Location)}). You remembered where the fish were.`);
  if (catAcc.Detail >= 0.8) strengths.push(`Great eye for detail (${pct(catAcc.Detail)}): counts and fish appearance.`);
  if (longAcc >= shortAcc - 0.1 && longAcc >= 0.6) strengths.push('Your performance held up as the sequences got longer and faster.');

  if (catAcc.Order < 0.6)
    improvements.push(`Order questions were hardest (${pct(catAcc.Order)}). Try silently naming each position as it appears ("top-left, bottom-right, …"). Words are easier to reverse than images.`);
  if (catAcc.Location < 0.6)
    improvements.push(`Location questions were hardest (${pct(catAcc.Location)}). Link each fish to its area of the pond as it appears ("blue stripes, north-east").`);
  if (catAcc.Detail < 0.6)
    improvements.push(`Detail questions were hardest (${pct(catAcc.Detail)}). Keep a running total of fish in your head as each group appears. Updating a count is easier than reconstructing it.`);
  if (longAcc < shortAcc - 0.25)
    improvements.push(`Accuracy dropped from ${pct(shortAcc)} on short rounds to ${pct(longAcc)} on long ones. Use chunking: group the sequence into pairs or triples instead of single items.`);
  if (reverse.length && mean(reverse.map((r) => r.credit)) < 0.5)
    improvements.push('For reverse order, rehearse the sequence forwards once, then read it back from the end, rather than trying to store it backwards.');

  if (!strengths.length) strengths.push('You completed all ten rounds, including the long, fast sequences at the end.');
  if (!improvements.length) improvements.push('Outstanding memory. To push further, try to answer just as quickly on the long rounds as on the short ones.');

  return {
    score,
    profile,
    metrics: [
      { label: 'Rounds fully correct', value: `${full.length} / ${recs.length}` },
      { label: 'Memory span', value: span ? `${span} groups` : '—', hint: 'Longest sequence answered fully correctly' },
      { label: 'Order questions', value: pct(catAcc.Order) },
      { label: 'Location questions', value: pct(catAcc.Location) },
      { label: 'Detail questions', value: pct(catAcc.Detail) },
      { label: 'Avg answer time', value: secs(avgRt) },
    ],
    strengths,
    improvements,
    chart: {
      title: 'Score per round',
      max: 100,
      note: 'Rounds get longer (more fish groups) and faster from top to bottom.',
      bars: recs.map((r, i) => ({
        label: `Round ${i + 1} · ${r.len} groups · ${r.type === 'where' ? 'location' : r.type === 'most' ? 'busiest area' : r.type === 'last' ? 'last group' : r.type}`,
        value: r.credit * 100,
        display: pct(r.credit),
      })),
    },
  };
}
