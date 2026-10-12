import { useEffect, useRef, useState } from 'react';
import type { GameProps, GameResult } from '../../lib/types';
import { mean, pct, scale, secs } from '../../lib/util';
import { useKeyDown } from '../../lib/hooks';
import { buildPractice, buildRun, type Kind } from './data';
import Exhibit from './Exhibit';
import Calculator from './Calculator';
import './numbers.css';

const Q_MS = 90_000;
// On phones the calculator starts folded away so the question stays on screen.
const calcOpen = typeof window === 'undefined' || window.matchMedia('(min-width: 861px)').matches;
const LETTERS = 'ABCDE';

interface Rec {
  kind: Kind;
  correct: boolean;
  ms: number;
  timedOut: boolean;
}

export default function NumbersGame({ onFinish, practice }: GameProps) {
  const [sets] = useState(() => (practice ? buildPractice() : buildRun()));
  const flat = sets.flatMap((d, di) => d.questions.map((q, qi) => ({ d, di, q, qi })));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const start = useRef(performance.now());
  const recs = useRef<Rec[]>([]);
  const cur = flat[idx];
  const reveal = practice && picked !== null;

  useEffect(() => {
    if (practice) return;
    const iv = window.setInterval(() => {
      const t = performance.now() - start.current;
      setNow(t);
      if (t >= Q_MS) answer(-1);
    }, 250);
    return () => clearInterval(iv);
  }, [idx]);

  function answer(choice: number) {
    if (picked !== null || recs.current.length > idx) return;
    recs.current.push({ kind: cur.q.kind, correct: choice === cur.q.answer, ms: Math.min(Q_MS, performance.now() - start.current), timedOut: choice < 0 });
    if (practice) setPicked(choice);
    else next();
  }

  function next() {
    if (idx + 1 >= flat.length) return onFinish(practice ? practiceResult(recs.current) : analyse(recs.current));
    setIdx(idx + 1);
    setPicked(null);
    setNow(0);
    start.current = performance.now();
  }

  useKeyDown((e) => {
    if (reveal && e.key === 'Enter') next();
  });

  const remaining = Math.max(0, Q_MS - now);

  return (
    <div className="stage numbers-stage">
      <div className="hud">
        <div className="hud-group">
          <span className="pill">
            Question {idx + 1} / {flat.length}
          </span>
          <span className="pill pill-accent">
            Data set {cur.di + 1} / {sets.length}
          </span>
          {!practice && (
            <span className={`pill ${remaining < 15000 ? 'pill-bad' : ''}`}>
              Time left <strong>{Math.ceil(remaining / 1000)}s</strong>
            </span>
          )}
        </div>
        {!practice && (
          <div className="progress-bar" style={{ maxWidth: 260 }}>
            <span style={{ width: `${(remaining / Q_MS) * 100}%` }} />
          </div>
        )}
      </div>
      <div className="progress-dots">
        {flat.map((_, i) => (
          <span key={i} className={i < idx ? 'done' : i === idx ? 'current' : ''} />
        ))}
      </div>

      <div className="nc-layout">
        <div className="nc-ex">
          <Exhibit data={cur.d} />
        </div>
        <details className="nc-calc-toggle" open={calcOpen}>
          <summary>Calculator</summary>
          <Calculator />
        </details>

        <div className="nc-question">
          <span className="q-label">
            Question {cur.qi + 1} on this data
          </span>
          <h3>{cur.q.prompt}</h3>
          <div className="nc-options">
            {cur.q.options.map((o, i) => (
              <button
                key={`${idx}-${i}`}
                className={['nc-option', reveal && i === cur.q.answer && 'correct', reveal && i === picked && i !== cur.q.answer && 'wrong'].filter(Boolean).join(' ')}
                onClick={() => answer(i)}
                disabled={picked !== null}
              >
                <span className="nc-letter">{LETTERS[i]}</span>
                {o}
              </button>
            ))}
          </div>

          {reveal ? (
            <>
              <div className={`verdict ${picked === cur.q.answer ? 'ok' : 'bad'}`}>
                <strong>{picked === cur.q.answer ? '✓ Correct!' : `✗ The answer is ${LETTERS[cur.q.answer]}: ${cur.q.options[cur.q.answer]}`}</strong>
              </div>
              <div className="explain">
                <strong>Worked solution</strong>
                {cur.q.explain}
              </div>
              <button className="btn btn-primary btn-lg accent-btn" onClick={next}>
                {idx + 1 >= flat.length ? 'Finish practice' : 'Next question'}
              </button>
            </>
          ) : (
            <p className="muted small">
              {practice
                ? 'Untimed. Use the calculator; real tests allow one too. After you answer, you get the worked solution.'
                : '90 seconds per question, no feedback until the end. The calculator is yours to use.'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Analysis ---------- */

function practiceResult(recs: Rec[]): GameResult {
  return {
    score: 0,
    metrics: [
      { label: 'Correct', value: `${recs.filter((r) => r.correct).length} / ${recs.length}` },
      { label: 'Avg time', value: secs(mean(recs.map((r) => r.ms))) },
    ],
    strengths: [],
    improvements: [
      'The real test has 9 questions on 3 data sets (a revenue table, a bar chart and a staff survey), 90 seconds each. Expect projections, currency conversion, ratios and weighted averages, too.',
    ],
  };
}

function analyse(recs: Rec[]): GameResult {
  const n = recs.length;
  const correct = recs.filter((r) => r.correct).length;
  const acc = correct / n;
  const avgOk = mean(recs.filter((r) => r.correct).map((r) => r.ms));
  const timeouts = recs.filter((r) => r.timedOut).length;
  const score = Math.round(100 * (0.85 * acc + 0.15 * (correct ? scale(avgOk, 80000, 25000) : 0)));

  const kinds = [...new Set(recs.map((r) => r.kind))].map((k) => {
    const rs = recs.filter((r) => r.kind === k);
    return { k, n: rs.length, acc: rs.filter((r) => r.correct).length / rs.length };
  });
  const weak = kinds.filter((x) => x.acc < 0.6).sort((a, b) => a.acc - b.acc);
  const strong = kinds.filter((x) => x.acc === 1 && x.n >= 2);

  const fast = correct > 0 && avgOk < 45000;
  const profile =
    acc >= 0.75
      ? fast
        ? { name: 'Data Navigator', description: 'You find the right numbers quickly and apply the right formula. This is the profile numerical tests reward most.' }
        : { name: 'Careful Calculator', description: 'You get the numbers right, but each question takes time. Learning the common question templates by heart will speed you up.' }
      : fast
        ? { name: 'Quick Estimator', description: 'You move fast, but some answers fall into the traps these tests set (wrong base, wrong row, plain average of percentages). Slow down for a sanity check.' }
        : { name: 'Building Fluency', description: 'Reading data and picking the right calculation is still effortful. Practising the handful of standard question types will make a big difference.' };

  const TIPS: Record<Kind, string> = {
    'percent change': 'Percent change = (new − old) ÷ old. Always divide by the starting value.',
    'share of total': 'A share is part ÷ whole. Check which total the question means: the column, the row, or everything?',
    'totals & averages': 'Read the question twice to be sure which row or column to add, and how many values you are averaging over.',
    projection: 'A growth of g% means multiplying by (1 + g/100). Don\'t add g as a plain number.',
    currency: 'Converting £ to € with "£1 = €x" means multiplying by x; going the other way means dividing.',
    'weighted average': 'Never average percentages from groups of different sizes. Turn them back into counts, add them up, then divide.',
    comparison: 'For "largest increase" questions, check whether the question asks about absolute numbers or percentages. The two often give different answers.',
  };

  const strengths: string[] = [];
  const improvements: string[] = [];
  if (acc >= 0.75) strengths.push(`${correct} of ${n} correct. Strong numerical reasoning.`);
  if (fast) strengths.push(`Efficient: ${secs(avgOk)} on average per correct answer.`);
  if (strong.length) strengths.push(`Flawless on ${strong.map((s) => s.k).join(' and ')} questions.`);
  if (timeouts === 0) strengths.push('You answered every question within the time limit.');
  for (const w of weak.slice(0, 2)) improvements.push(`${w.k[0].toUpperCase() + w.k.slice(1)}: ${pct(w.acc)} correct. ${TIPS[w.k]}`);
  if (timeouts >= 2) improvements.push(`${timeouts} questions timed out. Estimate first: often only one option is in the right ballpark, and you can skip the exact calculation.`);
  if (!fast && acc >= 0.5) improvements.push('Find the numbers you need before you touch the calculator. Most of the time goes on locating data, not on doing the arithmetic.');

  if (!strengths.length) strengths.push('You completed all three data sets. Each one gets easier as you learn the question types.');
  if (!improvements.length) improvements.push('Excellent. To push further, aim for 30 seconds per question without losing accuracy.');

  return {
    score,
    profile,
    metrics: [
      { label: 'Correct', value: `${correct} / ${n}` },
      { label: 'Accuracy', value: pct(acc) },
      { label: 'Avg time (correct)', value: correct ? secs(avgOk) : 'n/a' },
      { label: 'Timed out', value: String(timeouts) },
    ],
    strengths,
    improvements,
    chart: {
      title: 'Accuracy by question type',
      max: 100,
      note: 'Practising your lowest bars gives the biggest gains.',
      bars: kinds.map((k) => ({ label: k.k[0].toUpperCase() + k.k.slice(1), value: k.acc * 100, display: `${Math.round(k.acc * k.n)} / ${k.n}` })),
    },
  };
}
