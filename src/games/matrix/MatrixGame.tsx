import { useEffect, useRef, useState } from 'react';
import type { GameProps, GameResult } from '../../lib/types';
import { mean, median, pct, scale, secs } from '../../lib/util';
import { useKeyDown } from '../../lib/hooks';
import { RULE_FAMILY, describeCell, explainRule, generate, type Puzzle } from './generate';
import Figure, { FigureDefs } from './Figure';
import './matrix.css';

const LEVELS: (1 | 2 | 3)[] = [1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3];
const PRACTICE_LEVELS: (1 | 2 | 3)[] = [1, 1, 2];
const ITEM_MS = 90_000;
const LETTERS = 'ABCDEFGH';

interface Rec {
  level: number;
  families: string[];
  correct: boolean;
  ms: number;
  timedOut: boolean;
}

export default function MatrixGame({ onFinish, practice }: GameProps) {
  const [items] = useState(() => (practice ? PRACTICE_LEVELS : LEVELS).map((l) => generate(l)));
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const start = useRef(performance.now());
  const recs = useRef<Rec[]>([]);
  const item: Puzzle = items[idx];
  const reveal = practice && picked !== null;

  // Per-item clock (the real test only).
  useEffect(() => {
    if (practice) return;
    const iv = window.setInterval(() => {
      const t = performance.now() - start.current;
      setNow(t);
      if (t >= ITEM_MS) answer(-1);
    }, 250);
    return () => clearInterval(iv);
  }, [idx]);

  function answer(choice: number) {
    if (picked !== null || recs.current.length > idx) return;
    const ms = Math.min(ITEM_MS, performance.now() - start.current);
    recs.current.push({
      level: item.level,
      families: [...new Set(item.rules.map((r) => RULE_FAMILY[r.kind]))],
      correct: choice === item.answer,
      ms,
      timedOut: choice < 0,
    });
    if (practice) setPicked(choice);
    else next();
  }

  function next() {
    if (idx + 1 >= items.length) return onFinish(practice ? practiceResult(recs.current) : analyse(recs.current));
    setIdx(idx + 1);
    setPicked(null);
    setNow(0);
    start.current = performance.now();
  }

  useKeyDown((e) => {
    const n = Number(e.key);
    if (n >= 1 && n <= 8 && picked === null) answer(n - 1);
    const letter = LETTERS.indexOf(e.key.toUpperCase());
    if (letter >= 0 && e.key.length === 1 && picked === null) answer(letter);
    if (reveal && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      next();
    }
  });

  const remaining = Math.max(0, ITEM_MS - now);

  return (
    <div className="stage matrix-stage">
      <FigureDefs />
      <div className="hud">
        <div className="hud-group">
          <span className="pill">
            Puzzle {idx + 1} / {items.length}
          </span>
          <span className="pill pill-accent">Level {item.level}</span>
          {!practice && (
            <span className={`pill ${remaining < 15000 ? 'pill-bad' : ''}`}>
              Time left <strong>{Math.ceil(remaining / 1000)}s</strong>
            </span>
          )}
        </div>
        {!practice && (
          <div className="progress-bar" style={{ maxWidth: 260 }}>
            <span style={{ width: `${(remaining / ITEM_MS) * 100}%` }} />
          </div>
        )}
      </div>
      <div className="progress-dots">
        {items.map((_, i) => (
          <span key={i} className={i < idx ? 'done' : i === idx ? 'current' : ''} />
        ))}
      </div>

      <div className="mx-layout">
        <div className="mx-board-wrap">
          <p className="mx-prompt">Which option completes the pattern?</p>
          <div className="mx-board">
            {item.grid.flat().map((c, i) =>
              i === 8 ? (
                <div key={i} className={`mx-cell mx-missing ${reveal ? 'filled' : ''}`}>
                  {reveal ? <Figure cell={item.options[item.answer]} /> : <span>?</span>}
                </div>
              ) : (
                <div key={i} className="mx-cell">
                  <Figure cell={c} />
                </div>
              ),
            )}
          </div>
        </div>

        <div className="mx-side">
          <div className="mx-options">
            {item.options.map((o, i) => (
              <button
                key={`${idx}-${i}`}
                className={[
                  'mx-option',
                  reveal && i === item.answer && 'correct',
                  reveal && i === picked && i !== item.answer && 'wrong',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => answer(i)}
                disabled={picked !== null}
                aria-label={`Option ${LETTERS[i]}: ${describeCell(o)}`}
              >
                <span className="mx-letter">{LETTERS[i]}</span>
                <Figure cell={o} />
              </button>
            ))}
          </div>

          {reveal ? (
            <div className="mx-feedback">
              <div className={`verdict ${picked === item.answer ? 'ok' : 'bad'}`}>
                <strong>{picked === item.answer ? '✓ Correct!' : `✗ The answer is ${LETTERS[item.answer]}.`}</strong>
              </div>
              <div className="explain">
                <strong>The rule{item.rules.length > 1 ? 's' : ''}</strong>
                <ul>
                  {item.rules.map((r, k) => (
                    <li key={k}>{explainRule(r)}</li>
                  ))}
                  <li>Everything else stays the same in all nine cells.</li>
                </ul>
              </div>
              <button className="btn btn-primary btn-lg accent-btn" onClick={next}>
                {idx + 1 >= items.length ? 'Finish practice' : 'Next puzzle'}
              </button>
            </div>
          ) : (
            <p className="muted small mx-hint">
              {practice
                ? 'Tip: look at one feature at a time (shape, number, colour, fill, direction) and ask how it changes along each row. Work out the answer before you look at the options.'
                : 'Click an option or press A–H / 1–8. You get no feedback during the test, just like a real one.'}
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
      'The real test has 12 puzzles, 90 seconds each, and no feedback. From level 2 on, two or three rules run at the same time, and level 3 adds arithmetic (the third cell is the first two added or subtracted).',
    ],
  };
}

function analyse(recs: Rec[]): GameResult {
  const n = recs.length;
  const correct = recs.filter((r) => r.correct).length;
  const wAcc = recs.reduce((s, r) => s + (r.correct ? r.level : 0), 0) / recs.reduce((s, r) => s + r.level, 0);
  const okTimes = recs.filter((r) => r.correct).map((r) => r.ms);
  const medOk = median(okTimes);
  const speed = okTimes.length ? scale(medOk, 60000, 12000) : 0;
  const score = Math.round(100 * (0.85 * wAcc + 0.15 * speed));
  const timeouts = recs.filter((r) => r.timedOut).length;
  const byLevel = [1, 2, 3].map((l) => {
    const rs = recs.filter((r) => r.level === l);
    return rs.length ? rs.filter((r) => r.correct).length / rs.length : 0;
  });

  const families = [...new Set(recs.flatMap((r) => r.families))];
  const famAcc = families
    .map((f) => {
      const rs = recs.filter((r) => r.families.includes(f));
      return { f, n: rs.length, acc: rs.filter((r) => r.correct).length / rs.length };
    })
    .filter((x) => x.n >= 2)
    .sort((a, b) => a.acc - b.acc);
  const weakest = famAcc[0];

  const fast = okTimes.length > 0 && medOk < 30000;
  const accurate = correct / n >= 0.75;
  const profile = accurate
    ? fast
      ? { name: 'Pattern Hunter', description: 'You spot the hidden rules quickly and reliably, even when several run at once. This is exactly what inductive reasoning tests reward.' }
      : { name: 'Methodical Reasoner', description: 'You get to the right answer by working carefully through each feature. Accurate, but it takes time, so practising common rule types will speed you up.' }
    : fast
      ? { name: 'Quick Guesser', description: 'You answer fast, but often before you have found every rule. Slowing down to check each feature (and each row) would raise your score.' }
      : { name: 'Rule Seeker', description: 'Multi-rule patterns are still a challenge. Learning the handful of rule types these tests use, and checking features one at a time, will make a big difference.' };

  const strengths: string[] = [];
  const improvements: string[] = [];
  if (byLevel[2] >= 0.66) strengths.push(`Strong on the hardest puzzles: ${pct(byLevel[2])} correct on level 3, where three rules (including arithmetic) run at once.`);
  if (correct / n >= 0.75) strengths.push(`${correct} of ${n} correct, a high hit rate for an inductive reasoning test.`);
  if (fast) strengths.push(`Fast: your typical correct answer took ${secs(medOk)}.`);
  if (timeouts === 0) strengths.push('You answered every puzzle within the time limit.');
  const best = famAcc[famAcc.length - 1];
  if (best && best.acc >= 0.8 && famAcc.length > 1) strengths.push(`You were most reliable with "${best.f}" rules (${pct(best.acc)}).`);

  if (weakest && weakest.acc < 0.7) {
    const tip: Record<string, string> = {
      'Same within a row': 'Look for a feature that stays the same along a row but differs between rows.',
      'One of each per row': 'Check whether each row uses three different values of a feature. The missing one is then the value that row hasn\'t used yet. Columns follow the same pattern.',
      'Step-by-step change': 'Compare neighbouring cells: does the count or angle change by the same amount each step? Continue the step into the missing cell.',
      Arithmetic: 'When the counts change irregularly, test whether the third cell is the first two added or subtracted.',
    };
    improvements.push(`Your weakest rule type was "${weakest.f}" (${pct(weakest.acc)} correct). ${tip[weakest.f] ?? ''}`);
  }
  if (byLevel[2] < 0.5) improvements.push('Level 3 puzzles combine three rules. Solve one feature at a time (shape, count, colour, fill, direction) and only then put the pieces together.');
  if (timeouts >= 2) improvements.push(`${timeouts} puzzles ran out of time. If you haven't found a rule after about 60 seconds, eliminate the options you can and make your best guess. A blank always scores zero.`);
  if (!fast && accurate) improvements.push('You are accurate but slow. Predict the missing cell before looking at the options, then just find the match. It is much faster than checking each option against the grid.');
  if (!accurate && fast) improvements.push('Many quick answers were wrong. Before you click, check your answer against every row, not just the bottom one.');

  if (!strengths.length) strengths.push('You worked through all 12 puzzles. Recognising rule types gets much easier with practice.');
  if (!improvements.length) improvements.push('Excellent. To push further, aim to solve level 3 puzzles in under 30 seconds.');

  return {
    score,
    profile,
    metrics: [
      { label: 'Correct', value: `${correct} / ${n}` },
      { label: 'Level 1 · 2 · 3', value: byLevel.map((a) => pct(a)).join(' · '), hint: 'Accuracy per difficulty level' },
      { label: 'Typical solve time', value: okTimes.length ? secs(medOk) : 'n/a', hint: 'Median time on correct answers' },
      { label: 'Timed out', value: String(timeouts) },
      ...(weakest ? [{ label: 'Weakest rule type', value: weakest.f, hint: `${pct(weakest.acc)} correct` }] : []),
    ],
    strengths,
    improvements,
    chart: {
      title: 'Time per puzzle',
      max: ITEM_MS / 1000,
      note: 'Bars show seconds spent. Puzzles get harder from top to bottom.',
      bars: recs.map((r, i) => ({
        label: `${i + 1}. Level ${r.level}`,
        value: r.ms / 1000,
        display: `${r.timedOut ? 'Timed out' : r.correct ? '✓' : '✗'} · ${secs(r.ms)}`,
      })),
    },
  };
}
