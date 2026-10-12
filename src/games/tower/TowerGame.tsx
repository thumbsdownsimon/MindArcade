import { useRef, useState } from 'react';
import type { GameProps, GameResult } from '../../lib/types';
import { mean, pct, secs, sum } from '../../lib/util';
import { useTimeouts } from '../../lib/hooks';
import { PLAN, PRACTICE_PLAN, apply, capsFor, generate, same, solve, type Pegs, type Puzzle } from './engine';
import TowerScene from './TowerScene';
import './tower.css';

interface Rec {
  min: number;
  moves: number;
  solved: boolean;
  predicted: number;
  /** From seeing the puzzle to the first move (includes making the prediction). */
  planMs: number;
  totalMs: number;
}

const GUESSES = Array.from({ length: 11 }, (_, i) => i + 2);

export default function TowerGame({ onFinish, practice }: GameProps) {
  const [puzzles] = useState<Puzzle[]>(() => (practice ? PRACTICE_PLAN : PLAN).map(([b, m]) => generate(capsFor(b), b, m)));
  const [idx, setIdx] = useState(0);
  const p = puzzles[idx];
  const [pegs, setPegs] = useState<Pegs>(p.start);
  const [held, setHeld] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [predicted, setPredicted] = useState<number | null>(null);
  const [done, setDone] = useState<{ solved: boolean; text: string } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hint, setHint] = useState<[number, number] | null>(null);
  const t0 = useRef(performance.now());
  const firstMove = useRef<number | null>(null);
  const recs = useRef<Rec[]>([]);
  const later = useTimeouts();
  const maxMoves = p.min * 2 + 4;

  function say(msg: string) {
    setToast(msg);
    later(() => setToast((t) => (t === msg ? null : t)), 1800);
  }

  function finishPuzzle(solved: boolean, used: number) {
    const now = performance.now();
    recs.current.push({ min: p.min, moves: used, solved, predicted: predicted ?? 0, planMs: (firstMove.current ?? now) - t0.current, totalMs: now - t0.current });
    const predText = predicted === p.min ? 'Your prediction was spot on.' : `You predicted ${predicted}.`;
    setDone(
      solved
        ? { solved, text: used === p.min ? `Perfect: ${used} moves, the minimum. ${predText}` : `Solved in ${used} moves. The minimum was ${p.min}. ${predText}` }
        : { solved, text: `Out of moves. This one can be done in ${p.min}.` },
    );
    setHint(null);
    if (!practice) later(next, 2200);
  }

  function next() {
    if (idx + 1 >= puzzles.length) return onFinish(practice ? practiceResult(recs.current) : analyse(recs.current));
    const n = idx + 1;
    setIdx(n);
    setPegs(puzzles[n].start);
    setHeld(null);
    setMoves(0);
    setPredicted(null);
    setDone(null);
    t0.current = performance.now();
    firstMove.current = null;
  }

  function onPeg(i: number) {
    if (done || predicted === null) return;
    if (held === null) {
      if (!pegs[i].length) return say('That peg is empty. Click a peg with a block on it.');
      setHeld(i);
      return;
    }
    if (held === i) return setHeld(null);
    if (pegs[i].length >= p.caps[i]) return say(`That peg only holds ${p.caps[i]} block${p.caps[i] > 1 ? 's' : ''}.`);
    if (firstMove.current === null) firstMove.current = performance.now();
    const n = apply(pegs, [held, i]);
    const used = moves + 1;
    setPegs(n);
    setHeld(null);
    setMoves(used);
    setHint(null);
    if (same(n, p.goal)) finishPuzzle(true, used);
    else if (used >= maxMoves) finishPuzzle(false, used);
  }

  function showHint() {
    const path = solve(pegs, p.goal, p.caps);
    if (path.length) {
      setHint(path[0]);
      setHeld(null);
    }
  }

  return (
    <div className="stage tower-stage">
      <div className="hud">
        <div className="hud-group">
          <span className="pill">
            Puzzle {idx + 1} / {puzzles.length}
          </span>
          <span className="pill pill-accent">{sum(p.start.map((s) => s.length))} blocks</span>
          {predicted !== null && (
            <>
              <span className="pill">
                Moves <strong>{moves}</strong>
              </span>
              <span className="pill">
                Your plan <strong>{predicted}</strong>
              </span>
            </>
          )}
        </div>
        {practice && predicted !== null && !done && (
          <button className="btn btn-secondary btn-sm" onClick={showHint}>
            💡 Hint
          </button>
        )}
      </div>
      <div className="progress-dots">
        {puzzles.map((_, i) => (
          <span key={i} className={i < idx ? 'done' : i === idx ? 'current' : ''} />
        ))}
      </div>

      <div className="tower-layout">
        <div className="tower-view">
          <TowerScene
            key={idx}
            caps={p.caps}
            pegs={pegs}
            goal={p.goal}
            held={held === null ? null : { peg: held }}
            interactive={predicted !== null && !done}
            hint={hint}
            solved={!!done?.solved}
            onPeg={onPeg}
          />
          {toast && <div className="tower-toast">{toast}</div>}
          {done && (
            <div className={`overlay ${done.solved ? 'overlay-ok' : 'overlay-bad'}`}>
              <div className="overlay-card">
                <h3>{done.solved ? 'Solved!' : 'Not this time'}</h3>
                <p>{done.text}</p>
                {practice && (
                  <button className="btn btn-primary" onClick={next}>
                    {idx + 1 >= puzzles.length ? 'Finish practice' : 'Next puzzle'}
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="scene-tip">Drag to look around · scroll to zoom</div>
        </div>

        <aside className="tower-panel">
          {predicted === null ? (
            <>
              <span className="q-label">Step 1 · Plan</span>
              <h3>How many moves do you need?</h3>
              <p className="muted small">
                Make your board look like the goal. You can only move the top block of a peg, and the pegs hold {p.caps.join(', ')} blocks.
                Plan the whole solution in your head first, then pick the number of moves it takes.
              </p>
              <div className="tower-guess">
                {GUESSES.map((g) => (
                  <button key={g} className="btn btn-secondary" onClick={() => setPredicted(g)}>
                    {g}
                  </button>
                ))}
              </div>
              {practice && (
                <div className="explain">
                  <strong>How to plan</strong>
                  Start from the goal's bottom block: it has to be in place first, so what is blocking it? Work upwards from there. The
                  blocks on the short peg are usually the ones you'll move last.
                </div>
              )}
            </>
          ) : (
            <>
              <span className="q-label">Step 2 · Move</span>
              <h3>{held === null ? 'Click a peg to pick up its top block' : 'Now click the peg to put it on'}</h3>
              <p className="muted small">
                Click the same peg again to put the block back (that doesn't count as a move). You have up to {maxMoves} moves.
              </p>
              {hint && (
                <div className="explain">
                  <strong>Hint</strong>
                  Move the top block from the <span className="hint-from">yellow</span> peg to the <span className="hint-to">green</span> peg.
                </div>
              )}
              <div className="tower-meter" aria-label="Moves used">
                {Array.from({ length: Math.max(predicted, moves) }, (_, k) => (
                  <span key={k} className={k < moves ? (k < predicted ? 'used' : 'over') : ''} />
                ))}
              </div>
              <p className="muted small">Each bar is one move of your plan. Red bars mean you are past your plan.</p>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

/* ---------- Analysis ---------- */

function practiceResult(recs: Rec[]): GameResult {
  return {
    score: 0,
    metrics: [
      { label: 'Solved in the minimum', value: `${recs.filter((r) => r.solved && r.moves === r.min).length} / ${recs.length}` },
      { label: 'Exact predictions', value: `${recs.filter((r) => r.predicted === r.min).length} / ${recs.length}` },
    ],
    strengths: [],
    improvements: [
      'The real test has 10 puzzles: six with 3 blocks, then four with 4 blocks on taller pegs, needing up to 8 moves. There are no hints, and your prediction counts towards your score.',
    ],
  };
}

function analyse(recs: Rec[]): GameResult {
  const n = recs.length;
  const effOf = (r: Rec) => (r.solved ? r.min / r.moves : 0);
  const eff = mean(recs.map(effOf));
  const perfect = recs.filter((r) => r.solved && r.moves === r.min).length;
  const exact = recs.filter((r) => r.predicted === r.min).length;
  const predScore = mean(recs.map((r) => (r.predicted === r.min ? 1 : Math.abs(r.predicted - r.min) === 1 ? 0.5 : 0)));
  const bias = mean(recs.map((r) => r.predicted - r.min));
  const avgPlan = mean(recs.map((r) => r.planMs));
  const hard = recs.filter((r) => r.min >= 6);
  const hardEff = mean(hard.map(effOf));
  const extra = sum(recs.filter((r) => r.solved).map((r) => r.moves - r.min));
  const score = Math.round(100 * (0.75 * eff + 0.25 * predScore));

  const deliberate = avgPlan >= 9000;
  const profile =
    eff >= 0.85
      ? predScore >= 0.6
        ? { name: 'Master Planner', description: 'You see the full solution before you move, and you know exactly how long it is. This is planning ahead at its best.' }
        : { name: 'Efficient Doer', description: 'You find short solutions, but your up-front estimate is often off. You solve by looking a few moves ahead rather than planning everything.' }
      : deliberate
        ? { name: 'Thoughtful Planner', description: 'You take time to plan, but the plan doesn\'t always hold up. Practise checking each step of your mental plan against the peg limits.' }
        : { name: 'Hands-on Solver', description: 'You start moving quickly and figure it out as you go. That works for easy puzzles, but on the long ones a minute of planning saves many moves.' };

  const strengths: string[] = [];
  const improvements: string[] = [];
  if (perfect >= n / 2) strengths.push(`${perfect} of ${n} puzzles solved in the minimum number of moves.`);
  if (exact >= n / 2) strengths.push(`You predicted the exact number of moves ${exact} times, so your plans are accurate.`);
  if (hard.length && hardEff >= 0.85) strengths.push(`Strong on the long puzzles (6+ moves): ${pct(hardEff)} efficiency.`);
  if (recs.every((r) => r.solved)) strengths.push('You solved every puzzle.');

  if (eff < 0.8) improvements.push(`You used ${extra} extra moves in total. Before moving, find the goal's bottom block on each peg. Those must be placed first, so plan backwards from them.`);
  if (bias < -0.8) improvements.push(`You tend to underestimate (by ${Math.abs(bias).toFixed(1)} moves on average). Remember the moves that only clear a block out of the way.`);
  if (bias > 1) improvements.push(`You tend to overestimate (by ${bias.toFixed(1)} moves on average). Look for blocks that can go straight to their final spot.`);
  if (!deliberate && eff < 0.85) improvements.push(`You made your first move after ${secs(avgPlan)} on average. Planning tests reward thinking first. Try to see the whole solution before you touch anything.`);
  if (hard.length && hardEff < 0.7) improvements.push('The 4-block puzzles were hardest. Break them into stages: get the bottom row right first, then the next level.');

  if (!strengths.length) strengths.push('You worked through all ten puzzles, including the 4-block ones.');
  if (!improvements.length) improvements.push('Superb planning. To push further, aim to make your prediction in under 20 seconds.');

  return {
    score,
    profile,
    metrics: [
      { label: 'Perfect solutions', value: `${perfect} / ${n}`, hint: 'Minimum number of moves' },
      { label: 'Move efficiency', value: pct(eff), hint: 'Minimum moves ÷ moves you used' },
      { label: 'Exact predictions', value: `${exact} / ${n}` },
      { label: 'Prediction bias', value: `${bias > 0 ? '+' : ''}${bias.toFixed(1)}`, hint: 'Predicted minus minimum, on average' },
      { label: 'Planning time', value: secs(avgPlan), hint: 'Until your first move' },
    ],
    strengths,
    improvements,
    chart: {
      title: 'Moves used per puzzle',
      max: Math.max(...recs.map((r) => r.moves), 1),
      note: 'Each bar shows your moves; the label shows the minimum. Puzzles get longer from top to bottom.',
      bars: recs.map((r, i) => ({
        label: `${i + 1}. min ${r.min}`,
        value: r.moves,
        display: `${r.solved ? '' : 'Unsolved · '}${r.moves} moves · plan ${r.predicted}`,
      })),
    },
  };
}
