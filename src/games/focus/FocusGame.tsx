import { useRef, useState, type ReactNode } from 'react';
import type { GameProps, GameResult } from '../../lib/types';
import { median, pct, scale } from '../../lib/util';
import { useKeyDown, useTimeouts } from '../../lib/hooks';
import { INKS, dPrime, flankerTrials, nbackTrials, stroopTrials, type FlankerTrial, type NbackTrial, type StroopTrial, type TaskId } from './tasks';
import './focus.css';

const COUNTS = { flanker: 40, stroop: 40, nback: 32 };
const PRACTICE_COUNTS = { flanker: 8, stroop: 8, nback: 14 };
const ORDER: TaskId[] = ['flanker', 'stroop', 'nback'];
const LIMIT = { flanker: 1500, stroop: 2500 };
const NBACK_SHOW = 500;
const NBACK_TRIAL = 2500;

const INFO: Record<TaskId, { title: string; text: string; keys: string; tip: string }> = {
  flanker: {
    title: 'Arrows',
    text: 'Five arrows appear. Answer which way the MIDDLE arrow points and ignore the others, which sometimes point the opposite way.',
    keys: 'Press ← or → (or tap the buttons).',
    tip: 'Keep your eyes on the centre. The outer arrows are there to distract you.',
  },
  stroop: {
    title: 'Colour words',
    text: 'A colour word appears in coloured ink. Answer the INK colour, not the word. "RED" written in blue ink means the answer is Blue.',
    keys: 'Press 1–4 or tap the colour buttons.',
    tip: 'Reading is automatic, so you have to hold it back. Try to focus on the colour of the letters, as if the word were a blob of paint.',
  },
  nback: {
    title: '2-back',
    text: 'Letters appear one at a time. Press MATCH when the letter is the same as the one shown TWO letters earlier. Do nothing otherwise.',
    keys: 'Press Space (or tap MATCH).',
    tip: 'Keep repeating the last two letters to yourself ("K, T"), and drop the oldest one each time a new letter appears.',
  },
};

interface Rec {
  task: TaskId;
  /** Flanker/Stroop: congruent or not. N-back: whether this letter was a target. */
  easy: boolean;
  correct: boolean;
  /** Reaction time in ms, or null if there was no response. */
  rt: number | null;
  responded: boolean;
}

type Phase = 'intro' | 'fix' | 'stim' | 'gap';

export default function FocusGame({ onFinish, practice }: GameProps) {
  const counts = practice ? PRACTICE_COUNTS : COUNTS;
  const [seq] = useState(() => ({ flanker: flankerTrials(counts.flanker), stroop: stroopTrials(counts.stroop), nback: nbackTrials(counts.nback) }));
  const [block, setBlock] = useState(0);
  const [phase, setPhase] = useState<Phase>('intro');
  const [ti, setTi] = useState(0);
  const [fb, setFb] = useState<{ ok: boolean; text: string } | null>(null);
  const [nbackVisible, setNbackVisible] = useState(false);
  const task = ORDER[block];
  const later = useTimeouts();
  const live = useRef({ ti: 0, block: 0, stimAt: 0, answered: false, timer: 0 });
  const recs = useRef<Rec[]>([]);

  function startBlock() {
    live.current.block = block;
    run(0);
  }

  function run(i: number) {
    const t = ORDER[live.current.block];
    if (i >= counts[t]) return endBlock();
    live.current.ti = i;
    live.current.answered = false;
    setTi(i);
    setFb(null);
    if (t === 'nback') {
      setPhase('stim');
      setNbackVisible(true);
      live.current.stimAt = performance.now();
      later(() => setNbackVisible(false), NBACK_SHOW);
      live.current.timer = later(() => closeNback(i), NBACK_TRIAL);
      return;
    }
    setPhase('fix');
    later(() => {
      setPhase('stim');
      live.current.stimAt = performance.now();
      live.current.timer = later(() => respond(null, i), LIMIT[t]);
    }, 450);
  }

  function endBlock() {
    const b = live.current.block + 1;
    setFb(null);
    if (b >= ORDER.length) return onFinish(practice ? practiceResult(recs.current) : analyse(recs.current));
    setBlock(b);
    setPhase('intro');
  }

  /** Flanker and Stroop answers. `answer` is 'left'/'right' or an ink index; null means too slow. */
  function respond(answer: string | number | null, i = live.current.ti) {
    const t = ORDER[live.current.block];
    if (t === 'nback' || live.current.answered || i !== live.current.ti) return;
    live.current.answered = true;
    clearTimeout(live.current.timer);
    const rt = answer === null ? null : performance.now() - live.current.stimAt;
    let correct: boolean, easy: boolean, why: string;
    if (t === 'flanker') {
      const tr = seq.flanker[i] as FlankerTrial;
      correct = answer === tr.dir;
      easy = tr.congruent;
      why = `The middle arrow pointed ${tr.dir}.`;
    } else {
      const tr = seq.stroop[i] as StroopTrial;
      correct = answer === tr.ink;
      easy = tr.word === tr.ink;
      why = `The ink was ${INKS[tr.ink].name.toLowerCase()}${easy ? '' : `, even though the word said ${INKS[tr.word].name.toUpperCase()}`}.`;
    }
    recs.current.push({ task: t, easy, correct, rt, responded: answer !== null });
    setPhase('gap');
    if (practice) setFb({ ok: correct, text: answer === null ? `Too slow. ${why}` : correct ? 'Correct!' : `Wrong. ${why}` });
    later(() => run(i + 1), practice ? 1100 : 350);
  }

  function pressMatch() {
    const i = live.current.ti;
    if (ORDER[live.current.block] !== 'nback' || phase !== 'stim' || live.current.answered) return;
    live.current.answered = true;
    const tr = seq.nback[i] as NbackTrial;
    recs.current.push({ task: 'nback', easy: tr.target, correct: tr.target, rt: performance.now() - live.current.stimAt, responded: true });
    if (practice) setFb(tr.target ? { ok: true, text: 'Match! Well spotted.' } : { ok: false, text: `Not a match. Two letters back was ${seq.nback[i - 2]?.letter ?? 'nothing'}.` });
  }

  function closeNback(i: number) {
    if (!live.current.answered) {
      const tr = seq.nback[i] as NbackTrial;
      recs.current.push({ task: 'nback', easy: tr.target, correct: !tr.target, rt: null, responded: false });
      if (practice && tr.target) {
        setFb({ ok: false, text: `Missed: ${tr.letter} was also shown two letters earlier.` });
        later(() => run(i + 1), 1200);
        return;
      }
    }
    run(i + 1);
  }

  useKeyDown((e) => {
    if (phase === 'intro' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      return startBlock();
    }
    if (task === 'flanker' && phase === 'stim') {
      if (e.key === 'ArrowLeft') respond('left');
      if (e.key === 'ArrowRight') respond('right');
    }
    if (task === 'stroop' && phase === 'stim') {
      const k = Number(e.key);
      if (k >= 1 && k <= 4) respond(k - 1);
    }
    if (task === 'nback' && e.key === ' ') {
      e.preventDefault();
      pressMatch();
    }
  });

  const info = INFO[task];
  const total = counts[task];

  let stim: ReactNode = null;
  if (phase === 'fix') stim = <span className="fs-fix">+</span>;
  if (phase === 'stim' && task === 'flanker') {
    const tr = seq.flanker[ti];
    const mid = tr.dir === 'left' ? '←' : '→';
    const side = tr.congruent ? mid : tr.dir === 'left' ? '→' : '←';
    stim = <span className="fs-arrows">{`${side}${side}${mid}${side}${side}`}</span>;
  }
  if (phase === 'stim' && task === 'stroop') {
    const tr = seq.stroop[ti];
    stim = (
      <span className="fs-word" style={{ color: INKS[tr.ink].color }}>
        {INKS[tr.word].name.toUpperCase()}
      </span>
    );
  }
  if (task === 'nback' && phase !== 'intro') stim = <span className={`fs-letter ${nbackVisible ? '' : 'hidden'}`}>{seq.nback[ti]?.letter}</span>;

  return (
    <div className="stage focus-stage">
      <div className="hud">
        <div className="hud-group">
          {ORDER.map((t, i) => (
            <span key={t} className={`pill ${i === block ? 'pill-accent' : ''}`}>
              {i < block ? '✓ ' : ''}
              {INFO[t].title}
            </span>
          ))}
        </div>
        {phase !== 'intro' && (
          <div className="progress-bar" style={{ maxWidth: 260 }}>
            <span style={{ width: `${(ti / total) * 100}%` }} />
          </div>
        )}
      </div>

      <div className="fs-screen">
        <div className="fs-stim">{stim}</div>
        {fb && <div className={`fs-fb ${fb.ok ? 'ok' : 'bad'}`}>{fb.text}</div>}

        {phase === 'intro' && (
          <div className="overlay">
            <div className="overlay-card">
              <span className="eyebrow">
                Part {block + 1} of 3{practice ? ' · practice' : ''}
              </span>
              <h3>{info.title}</h3>
              <p>{info.text}</p>
              <p className="small">
                <strong>{info.keys}</strong> Be as fast and accurate as you can.
              </p>
              {practice && <p className="small">Tip: {info.tip}</p>}
              <button className="btn btn-primary" onClick={startBlock}>
                Start {info.title.toLowerCase()}
              </button>
              <p className="muted small">or press Enter</p>
            </div>
          </div>
        )}
      </div>

      <div className="fs-controls">
        {task === 'flanker' && (
          <>
            <button className="btn btn-secondary btn-lg fs-btn" onPointerDown={() => respond('left')} disabled={phase !== 'stim'}>
              ← Left
            </button>
            <button className="btn btn-secondary btn-lg fs-btn" onPointerDown={() => respond('right')} disabled={phase !== 'stim'}>
              Right →
            </button>
          </>
        )}
        {task === 'stroop' &&
          INKS.map((ink, i) => (
            <button key={ink.name} className="btn btn-secondary btn-lg fs-btn" onPointerDown={() => respond(i)} disabled={phase !== 'stim'}>
              <kbd>{i + 1}</kbd> {ink.name}
            </button>
          ))}
        {task === 'nback' && (
          <button className="btn btn-primary btn-lg accent-btn fs-btn fs-match" onPointerDown={pressMatch} disabled={phase !== 'stim'}>
            MATCH <kbd>Space</kbd>
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Analysis ---------- */

function taskStats(recs: Rec[], task: 'flanker' | 'stroop') {
  const rs = recs.filter((r) => r.task === task);
  const acc = rs.filter((r) => r.correct).length / Math.max(1, rs.length);
  const rt = (easy: boolean) => median(rs.filter((r) => r.easy === easy && r.correct && r.rt !== null).map((r) => r.rt!));
  const easyRt = rt(true);
  const hardRt = rt(false);
  return { acc, easyRt, hardRt, cost: hardRt - easyRt, hardAcc: rs.filter((r) => !r.easy && r.correct).length / Math.max(1, rs.filter((r) => !r.easy).length) };
}

function nbackStats(recs: Rec[]) {
  const rs = recs.filter((r) => r.task === 'nback');
  const targets = rs.filter((r) => r.easy);
  const lures = rs.filter((r) => !r.easy);
  const hits = targets.filter((r) => r.responded).length;
  const fas = lures.filter((r) => r.responded).length;
  return { hits, targets: targets.length, fas, lures: lures.length, d: dPrime(hits, targets.length, fas, lures.length), hitRate: hits / Math.max(1, targets.length) };
}

function practiceResult(recs: Rec[]): GameResult {
  const f = taskStats(recs, 'flanker');
  const s = taskStats(recs, 'stroop');
  const nb = nbackStats(recs);
  return {
    score: 0,
    metrics: [
      { label: 'Arrows accuracy', value: pct(f.acc) },
      { label: 'Colour words accuracy', value: pct(s.acc) },
      { label: '2-back matches found', value: `${nb.hits} / ${nb.targets}` },
    ],
    strengths: [],
    improvements: [
      'The real test has 40 arrow trials, 40 colour-word trials and 32 letters, with no feedback. Reaction time counts, so stay in a steady rhythm: fast but not rushed.',
    ],
  };
}

function analyse(recs: Rec[]): GameResult {
  const f = taskStats(recs, 'flanker');
  const s = taskStats(recs, 'stroop');
  const nb = nbackStats(recs);
  const fScore = 0.5 * scale(f.acc, 0.75, 0.98) + 0.25 * scale(f.cost, 150, 20) + 0.25 * scale(f.easyRt, 750, 400);
  const sScore = 0.5 * scale(s.acc, 0.7, 0.98) + 0.25 * scale(s.cost, 300, 50) + 0.25 * scale(s.easyRt, 1200, 650);
  const nScore = scale(nb.d, 0.5, 3.5);
  const score = Math.round((100 * (fScore + sScore + nScore)) / 3);
  const parts = [
    { name: 'Arrows (flanker)', v: fScore },
    { name: 'Colour words (Stroop)', v: sScore },
    { name: '2-back memory', v: nScore },
  ].sort((a, b) => b.v - a.v);

  const profile =
    score >= 75
      ? { name: 'Laser Focus', description: 'You shut out distractions, hold back automatic responses and keep information updated in mind, all at speed.' }
      : parts[0].v - parts[2].v > 0.3
        ? parts[2].name.startsWith('2-back')
          ? { name: 'Distraction-Proof', description: 'You are very good at ignoring distractions, but keeping a running memory (2-back) is harder for you.' }
          : { name: 'Strong Updater', description: 'Your working memory is a strength, but conflicting information (arrows or colour words) slows you down or trips you up.' }
        : { name: 'Steady Attender', description: 'An even profile across the three attention tasks. Practice will sharpen your speed and accuracy across the board.' };

  const strengths: string[] = [];
  const improvements: string[] = [];
  if (f.acc >= 0.95) strengths.push(`Arrows: ${pct(f.acc)} accuracy. The outer arrows barely fooled you.`);
  if (f.cost <= 50 && f.acc >= 0.85) strengths.push(`Only ${Math.round(f.cost)} ms slower on conflict arrows. Excellent focus.`);
  if (s.hardAcc >= 0.9) strengths.push(`Colour words: ${pct(s.hardAcc)} correct even when the word and ink clashed.`);
  if (nb.d >= 2.5) strengths.push(`2-back: you found ${nb.hits} of ${nb.targets} matches with few false alarms. A strong working memory.`);
  strengths.push(`Your strongest part was ${parts[0].name}.`);

  if (f.cost > 100) improvements.push(`Conflicting arrows cost you ${Math.round(f.cost)} ms. Fix your gaze on the exact centre before each trial.`);
  if (s.hardAcc < 0.85) improvements.push(`Clashing colour words caught you ${pct(1 - s.hardAcc)} of the time. Focus on the colour of the letters, not the word.`);
  if (s.cost > 250) improvements.push(`Clashing words slowed you by ${Math.round(s.cost)} ms. That is normal, but practice shrinks it.`);
  if (nb.hitRate < 0.6) improvements.push(`2-back: you found ${nb.hits} of ${nb.targets} matches. Silently repeat the last two letters as a pair and update it with each new letter.`);
  if (nb.fas >= 4) improvements.push(`2-back: ${nb.fas} false alarms. Only press when you are sure; a letter that repeats right away (1-back) is not a match.`);

  if (!improvements.length) improvements.push(`Your weakest part was ${parts[2].name}. Small gains there will lift your overall score.`);

  return {
    score,
    profile,
    metrics: [
      { label: 'Arrows accuracy', value: pct(f.acc) },
      { label: 'Arrows conflict cost', value: `${Math.round(f.cost)} ms`, hint: 'Slower on mixed arrows' },
      { label: 'Colour words accuracy', value: pct(s.acc) },
      { label: 'Stroop conflict cost', value: `${Math.round(s.cost)} ms`, hint: 'Slower when word ≠ ink' },
      { label: '2-back matches', value: `${nb.hits} / ${nb.targets}`, hint: `${nb.fas} false alarms` },
      { label: "2-back d′", value: nb.d.toFixed(2), hint: 'Sensitivity: 1 is fair, 3+ excellent' },
    ],
    strengths,
    improvements,
    chart: {
      title: 'Reaction time: easy vs conflict trials',
      max: Math.max(f.hardRt, s.hardRt, f.easyRt, s.easyRt, 1) * 1.1,
      note: 'Median time on correct answers. The gap between each pair is the cost of the distraction.',
      bars: [
        { label: 'Arrows · all the same', value: f.easyRt, display: `${Math.round(f.easyRt)} ms` },
        { label: 'Arrows · mixed', value: f.hardRt, display: `${Math.round(f.hardRt)} ms` },
        { label: 'Colour words · matching', value: s.easyRt, display: `${Math.round(s.easyRt)} ms` },
        { label: 'Colour words · clashing', value: s.hardRt, display: `${Math.round(s.hardRt)} ms` },
      ],
    },
  };
}

