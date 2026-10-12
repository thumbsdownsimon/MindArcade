import { useRef, useState } from 'react';
import type { GameProps, GameResult } from '../../lib/types';
import { median, pct, pick, scale, secs } from '../../lib/util';
import { useKeyDown, useTimeouts } from '../../lib/hooks';
import './switch.css';

type Dim = 'colour' | 'shape' | 'number';
type ShapeName = 'triangle' | 'star' | 'cross' | 'circle';

interface Card {
  color: number;
  shape: number;
  count: number; // 1–4
}

const COLORS = ['#dc2626', '#16a34a', '#eab308', '#2563eb'];
const SHAPES: ShapeName[] = ['triangle', 'star', 'cross', 'circle'];
/** The four key cards: 1 red triangle, 2 green stars, 3 yellow crosses, 4 blue circles. */
const KEYS: Card[] = [0, 1, 2, 3].map((i) => ({ color: i, shape: i, count: i + 1 }));
const DIMS: Dim[] = ['colour', 'shape', 'number'];

const REAL = { cards: 60, streak: 6 };
const PRACTICE = { cards: 18, streak: 4 };

/** Which key card matches on a dimension. */
const keyFor = (c: Card, d: Dim) => (d === 'colour' ? c.color : d === 'shape' ? c.shape : c.count - 1);

/** Cards that match a different key card on each dimension, so every choice reveals which rule was used. */
function randomCard(prev?: Card): Card {
  for (;;) {
    const c = { color: pick([0, 1, 2, 3]), shape: pick([0, 1, 2, 3]), count: pick([1, 2, 3, 4]) };
    const keys = DIMS.map((d) => keyFor(c, d));
    if (new Set(keys).size === 3 && !(prev && prev.color === c.color && prev.shape === c.shape && prev.count === c.count)) return c;
  }
}

function nextRule(cur: Dim | null): Dim {
  return pick(DIMS.filter((d) => d !== cur));
}

/* ---------- Card drawing ---------- */

const POS: Record<number, [number, number][]> = {
  1: [[50, 50]],
  2: [[50, 30], [50, 70]],
  3: [[50, 22], [30, 70], [70, 70]],
  4: [[30, 30], [70, 30], [30, 70], [70, 70]],
};

function Glyph({ shape, color, x, y, r }: { shape: ShapeName; color: string; x: number; y: number; r: number }) {
  const t = `translate(${x} ${y})`;
  if (shape === 'circle') return <circle cx={x} cy={y} r={r * 0.85} fill={color} />;
  if (shape === 'triangle') return <polygon transform={t} points={`0,${-r} ${r * 0.95},${r * 0.75} ${-r * 0.95},${r * 0.75}`} fill={color} />;
  if (shape === 'cross') {
    const w = r * 0.38;
    return <path transform={t} d={`M${-w},${-r}h${2 * w}v${r - w}h${r - w}v${2 * w}h${-(r - w)}v${r - w}h${-2 * w}v${-(r - w)}h${-(r - w)}v${-2 * w}h${r - w}z`} fill={color} />;
  }
  const pts = Array.from({ length: 10 }, (_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.45 : r;
    return `${(Math.cos(a) * rr).toFixed(1)},${(Math.sin(a) * rr).toFixed(1)}`;
  }).join(' ');
  return <polygon transform={t} points={pts} fill={color} />;
}

function CardFace({ card }: { card: Card }) {
  const r = card.count === 1 ? 22 : card.count === 2 ? 17 : 15;
  return (
    <svg viewBox="0 0 100 100" className="ws-face" aria-hidden="true">
      {POS[card.count].map(([x, y], k) => (
        <Glyph key={k} shape={SHAPES[card.shape]} color={COLORS[card.color]} x={x} y={y} r={r} />
      ))}
    </svg>
  );
}

const describe = (c: Card) => `${c.count} ${['red', 'green', 'yellow', 'blue'][c.color]} ${SHAPES[c.shape]}${c.count > 1 ? (SHAPES[c.shape] === 'cross' ? 'es' : 's') : ''}`;

/* ---------- Game ---------- */

interface Trial {
  rule: Dim;
  prevRule: Dim | null;
  /** Correct answers in a row under this rule before this card. */
  streakBefore: number;
  /** Cards since the rule last changed (0 = first card under the new rule). */
  sinceSwitch: number;
  chosenDim: Dim | null;
  correct: boolean;
  rt: number;
}

export default function SwitchGame({ onFinish, practice }: GameProps) {
  const cfg = practice ? PRACTICE : REAL;
  const [card, setCard] = useState<Card>(() => randomCard());
  const [n, setN] = useState(0);
  const [fb, setFb] = useState<{ ok: boolean; pile: number } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const rule = useRef<Dim>(nextRule(null));
  const prevRule = useRef<Dim | null>(null);
  const streak = useRef(0);
  const sinceSwitch = useRef(0);
  const wrongRun = useRef(0);
  const categories = useRef(0);
  const shownAt = useRef(performance.now());
  const trials = useRef<Trial[]>([]);
  const later = useTimeouts();

  function choose(pile: number) {
    if (!started || fb) return;
    const rt = performance.now() - shownAt.current;
    const chosenDim = DIMS.find((d) => keyFor(card, d) === pile) ?? null;
    const correct = keyFor(card, rule.current) === pile;
    trials.current.push({ rule: rule.current, prevRule: prevRule.current, streakBefore: streak.current, sinceSwitch: sinceSwitch.current, chosenDim, correct, rt });
    setFb({ ok: correct, pile });
    sinceSwitch.current++;

    let msg: string | null = null;
    if (correct) {
      streak.current++;
      wrongRun.current = 0;
      if (streak.current >= cfg.streak) {
        // Switch the rule without telling the player (in practice we do tell them, afterwards).
        categories.current++;
        prevRule.current = rule.current;
        rule.current = nextRule(rule.current);
        streak.current = 0;
        sinceSwitch.current = 0;
        if (practice) msg = `${cfg.streak} in a row: you found the rule (${prevRule.current}). Now the rule changes. Watch for the next ✗.`;
      }
    } else {
      streak.current = 0;
      wrongRun.current++;
      if (practice && wrongRun.current >= 3) msg = `Hint: the rule right now is ${rule.current}.`;
      else if (practice && wrongRun.current === 1 && sinceSwitch.current > 1) msg = 'Wrong. If your old rule stopped working, try sorting by something else: colour, shape or number.';
    }
    if (msg) setNote(msg);

    later(() => {
      setFb(null);
      const done = n + 1;
      if (done >= cfg.cards) return onFinish(practice ? practiceResult(trials.current, categories.current) : analyse(trials.current, categories.current));
      setN(done);
      setCard((c) => randomCard(c));
      shownAt.current = performance.now();
    }, practice ? 900 : 650);
  }

  useKeyDown((e) => {
    if (!started && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      begin();
    }
    const k = Number(e.key);
    if (k >= 1 && k <= 4) choose(k - 1);
  });

  function begin() {
    setStarted(true);
    shownAt.current = performance.now();
  }

  return (
    <div className="stage switch-stage">
      <div className="hud">
        <div className="hud-group">
          <span className="pill">
            Card {Math.min(n + 1, cfg.cards)} / {cfg.cards}
          </span>
          {practice && (
            <span className="pill pill-accent">
              Rules found <strong>{categories.current}</strong>
            </span>
          )}
        </div>
        <div className="progress-bar" style={{ maxWidth: 260 }}>
          <span style={{ width: `${(n / cfg.cards) * 100}%` }} />
        </div>
      </div>

      <div className="ws-table">
        <div className="ws-keys">
          {KEYS.map((k, i) => (
            <button
              key={i}
              className={`ws-card ws-key ${fb?.pile === i ? (fb.ok ? 'hit' : 'miss') : ''}`}
              onClick={() => choose(i)}
              disabled={!started || !!fb}
              aria-label={`Pile ${i + 1}: ${describe(k)}`}
            >
              <CardFace card={k} />
              <span className="ws-key-num">{i + 1}</span>
            </button>
          ))}
        </div>

        <div className="ws-current">
          <div className={`ws-card ws-draw ${fb ? 'placed' : ''}`} key={n} aria-label={`Card to sort: ${describe(card)}`}>
            <CardFace card={card} />
          </div>
          <div className={`ws-feedback ${fb ? (fb.ok ? 'ok' : 'bad') : ''}`} aria-live="polite">
            {fb ? (fb.ok ? '✓ Correct' : '✗ Wrong') : started ? 'Which pile does this card belong to?' : ''}
          </div>
        </div>

        {note && practice && (
          <div className="explain ws-note">
            {note}
            <button className="btn btn-ghost btn-sm" onClick={() => setNote(null)}>
              OK
            </button>
          </div>
        )}

        {!started && (
          <div className="overlay">
            <div className="overlay-card">
              <span className="eyebrow">{practice ? 'Practice' : 'Rule switch'}</span>
              <h3>Sort the cards</h3>
              <p>
                Put each card on one of the four piles by clicking it (or pressing 1–4). You are not told the rule: it could be{' '}
                <strong>colour</strong>, <strong>shape</strong> or <strong>number</strong>. Use the ✓ / ✗ feedback to work it out. Every now
                and then the rule changes without warning.
              </p>
              {practice && <p className="small">In practice the rule changes after {cfg.streak} correct in a row, and you'll get hints when you get stuck.</p>}
              <button className="btn btn-primary" onClick={begin}>
                Start
              </button>
              <p className="muted small">or press Space</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Analysis ---------- */

function practiceResult(trials: Trial[], categories: number): GameResult {
  return {
    score: 0,
    metrics: [
      { label: 'Rules found', value: String(categories) },
      { label: 'Accuracy', value: pct(trials.filter((t) => t.correct).length / trials.length) },
    ],
    strengths: [],
    improvements: [
      'The real test has 60 cards, the rule changes after 6 correct in a row, and there are no hints. The key skill: after a ✗ that follows a run of ✓, switch to a new rule right away instead of trying the old one again.',
    ],
  };
}

function analyse(trials: Trial[], categories: number): GameResult {
  const n = trials.length;
  const correct = trials.filter((t) => t.correct).length;
  const acc = correct / n;
  const errors = n - correct;
  // Perseverative error: still sorting by the previous rule after it changed.
  const persev = trials.filter((t) => !t.correct && t.prevRule && t.chosenDim === t.prevRule).length;
  // Failure to keep the rule: a mistake after 3+ correct in a row under the same rule.
  const lostSet = trials.filter((t) => !t.correct && t.streakBefore >= 3).length;
  const firstCat = (() => {
    let s = 0;
    for (let i = 0; i < n; i++) {
      s = trials[i].correct ? s + 1 : 0;
      if (s >= REAL.streak) return i + 1;
    }
    return null;
  })();
  // How many cards it takes to settle on a new rule after a switch.
  const recover: number[] = [];
  trials.forEach((t, i) => {
    if (t.sinceSwitch !== 0 || !t.prevRule) return;
    let k = i, run = 0;
    while (k < n && trials[k].rule === t.rule && run < 3) {
      run = trials[k].correct ? run + 1 : 0;
      k++;
    }
    if (run >= 3) recover.push(k - i - 3);
  });
  const avgRecover = recover.length ? recover.reduce((a, b) => a + b, 0) / recover.length : null;
  const rt = median(trials.map((t) => t.rt));
  const persevRate = persev / n;
  const score = Math.round(100 * (0.6 * scale(acc, 0.5, 0.92) + 0.25 * scale(persevRate, 0.15, 0.02) + 0.15 * scale(rt, 2600, 900)));

  const flexible = persev <= 4 && (avgRecover ?? 9) <= 2;
  const profile =
    acc >= 0.8
      ? flexible
        ? { name: 'Quick Switcher', description: 'You let go of a rule as soon as it stops working and find the new one fast. That is cognitive flexibility in action.' }
        : { name: 'Steady Sorter', description: 'You sort accurately, but after a rule change you sometimes hold on to the old rule for a card or two.' }
      : persev > 8
        ? { name: 'Rule Holder', description: 'Once you have a rule, you hold on to it, even after the feedback says it stopped working. Treat a ✗ after a run of ✓ as the signal to switch.' }
        : { name: 'Explorer', description: 'You try different rules, but often switch without a clear system. Test one dimension at a time: colour, then shape, then number.' };

  const strengths: string[] = [];
  const improvements: string[] = [];
  if (categories >= 6) strengths.push(`You found ${categories} rules in 60 cards. Very efficient rule discovery.`);
  if (persev <= 3) strengths.push(`Only ${persev} perseverative errors: you dropped old rules quickly when they stopped working.`);
  if (lostSet <= 1) strengths.push('You kept a working rule once you had it. Almost no lapses mid-run.');
  if (firstCat !== null && firstCat <= 9) strengths.push(`You cracked the first rule within ${firstCat} cards.`);
  if (rt < 1200) strengths.push(`Fast decisions: ${secs(rt)} per card (median).`);

  if (persev >= 6) improvements.push(`${persev} errors came from sticking with the previous rule. When a ✗ follows a run of ✓, the rule has changed, so switch immediately and don't test the old rule again.`);
  if (lostSet >= 3) improvements.push(`${lostSet} times you made a mistake after 3+ correct in a row. Once you have a rule, stay with it until the feedback says otherwise.`);
  if (avgRecover !== null && avgRecover > 3) improvements.push(`It took about ${avgRecover.toFixed(1)} cards to settle on a new rule. With only three possible rules, you need at most two tries: rule out the old one and test the next.`);
  if (rt > 2200) improvements.push('Your decisions were slow. Once you know the rule, sorting should be quick, so save your thinking for the moments after a ✗.');

  if (!strengths.length) strengths.push('You sorted all 60 cards and kept adapting to the changing rule.');
  if (!improvements.length) improvements.push('Excellent flexibility. To push further, aim to find each new rule within 2 cards.');

  return {
    score,
    profile,
    metrics: [
      { label: 'Rules found', value: String(categories), hint: '6 correct in a row each' },
      { label: 'Accuracy', value: pct(acc) },
      { label: 'Perseverative errors', value: String(persev), hint: 'Kept using the old rule' },
      { label: 'Other errors', value: String(errors - persev) },
      { label: 'Cards to adapt', value: avgRecover === null ? 'n/a' : avgRecover.toFixed(1), hint: 'Mistakes after a rule change' },
      { label: 'Decision time', value: secs(rt), hint: 'Median per card' },
    ],
    strengths,
    improvements,
    chart: {
      title: 'Errors in each block of 10 cards',
      max: 10,
      note: 'Spikes usually follow a rule change. A quick drop afterwards means fast adaptation.',
      bars: Array.from({ length: Math.ceil(n / 10) }, (_, b) => {
        const block = trials.slice(b * 10, b * 10 + 10);
        const e = block.filter((t) => !t.correct).length;
        const p = block.filter((t) => !t.correct && t.prevRule && t.chosenDim === t.prevRule).length;
        return { label: `Cards ${b * 10 + 1}–${b * 10 + block.length}`, value: e, display: `${e} errors${p ? ` (${p} old rule)` : ''}` };
      }),
    },
  };
}
