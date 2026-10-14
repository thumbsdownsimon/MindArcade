import { Suspense, useState, type CSSProperties, type ReactNode } from 'react';
import type { GameMeta, GameResult } from '../lib/types';
import { bestScore, gameHistory, saveResult } from '../lib/storage';
import { ArrowLeft, CheckIcon, ClockIcon, PlayIcon, RetryIcon, TargetIcon } from './Icons';
import ResultsView from './ResultsView';

type Phase = 'intro' | 'practice' | 'practiceDone' | 'play' | 'results' | 'retry' | 'retryDone';

/** The card shown after an unscored round (practice or retry). */
function RoundDone({ tag, title, text, result, children }: { tag: string; title: string; text: string; result: GameResult | null; children: ReactNode }) {
  return (
    <div className="card intro-card practice-done">
      <span className="practice-done-icon">
        <CheckIcon size={30} />
      </span>
      <span className="practice-tag">{tag}</span>
      <h1>{title}</h1>
      <p className="muted">{text}</p>
      {result && result.metrics.length > 0 && (
        <div className="practice-metrics">
          {result.metrics.slice(0, 4).map((m) => (
            <div key={m.label} className="card-inset practice-metric">
              <strong>{m.value}</strong>
              <span className="muted small">{m.label}</span>
            </div>
          ))}
        </div>
      )}
      {result?.improvements[0] && (
        <p className="practice-tip">
          <TargetIcon /> <span>{result.improvements[0]}</span>
        </p>
      )}
      <div className="practice-done-actions">{children}</div>
    </div>
  );
}

export default function GameShell({ game }: { game: GameMeta }) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
  // Result of the last unscored round (practice or retry), and the items a retry round replays.
  const [roundResult, setRoundResult] = useState<GameResult | null>(null);
  const [retryItems, setRetryItems] = useState<unknown[]>([]);
  const [prevBest, setPrevBest] = useState<number | null>(null);
  const [prevPlays, setPrevPlays] = useState(0);

  function finish(r: GameResult) {
    setPrevBest(bestScore(game.id));
    setPrevPlays(gameHistory(game.id).length);
    saveResult(game.id, r);
    setResult(r);
    setPhase('results');
    window.scrollTo(0, 0);
  }

  // Practice and retry results are never saved: they only show how the round went.
  function finishRound(r: GameResult) {
    setRoundResult(r);
    setPhase(phase === 'practice' ? 'practiceDone' : 'retryDone');
    window.scrollTo(0, 0);
  }

  function go(next: 'practice' | 'play' | 'retry', items?: unknown[]) {
    if (items) setRetryItems(items);
    setRun((n) => n + 1);
    setPhase(next);
    window.scrollTo(0, 0);
  }

  const style = { '--accent': game.accent } as CSSProperties;

  if (phase === 'results' && result)
    return (
      <div style={style}>
        <ResultsView game={game} result={result} prevBest={prevBest} prevPlays={prevPlays} onReplay={() => go('play')} onPractice={() => go('practice')} onRetry={(items) => go('retry', items)} />
      </div>
    );

  if (phase === 'practice' || phase === 'play' || phase === 'retry') {
    const practice = phase === 'practice';
    const retrying = phase === 'retry';
    return (
      <div style={style} className="play">
        <div className="play-bar">
          <a href="#/" className="btn btn-ghost btn-sm">
            <ArrowLeft size={16} /> Quit
          </a>
          <div className="play-title">
            <span className="game-icon sm">
              <game.Icon size={18} />
            </span>
            <strong>{game.title}</strong>
            {practice ? (
              <span className="practice-tag">Practice</span>
            ) : retrying ? (
              <span className="practice-tag">Retry round</span>
            ) : (
              <span className="skill-tag">{game.skill}</span>
            )}
          </div>
          <span className="play-bar-spacer">
            {practice && (
              <button className="btn btn-ghost btn-sm" onClick={() => go('play')}>
                Skip to real test
              </button>
            )}
          </span>
        </div>
        <Suspense fallback={<div className="stage game-loading">Loading game…</div>}>
          <game.Component
            key={run}
            practice={practice}
            retry={retrying ? retryItems : undefined}
            onFinish={practice || retrying ? finishRound : finish}
          />
        </Suspense>
      </div>
    );
  }

  if (phase === 'practiceDone')
    return (
      <div style={style} className="intro">
        <RoundDone
          tag="Practice complete"
          title="You're ready for the real test"
          text={`The real ${game.title} is ${game.duration} long and is scored. Practice rounds are never saved, so feel free to practise again if anything felt unclear.`}
          result={roundResult}
        >
          <button className="btn btn-secondary btn-lg" onClick={() => go('practice')}>
            <RetryIcon /> Practise again
          </button>
          <button className="btn btn-primary btn-lg accent-btn" onClick={() => go('play')}>
            <PlayIcon /> Start the real test
          </button>
        </RoundDone>
      </div>
    );

  if (phase === 'retryDone') {
    const again = roundResult?.retry;
    return (
      <div style={style} className="intro">
        <RoundDone
          tag="Retry round complete"
          title={again ? 'Getting there' : 'All perfect'}
          text="Retry rounds aren't scored, so your test result stays as it was."
          result={roundResult}
        >
          <button className="btn btn-secondary btn-lg" onClick={() => setPhase('results')}>
            <ArrowLeft /> Back to results
          </button>
          {again && (
            <button className="btn btn-secondary btn-lg" onClick={() => go('retry', again.items)}>
              <TargetIcon /> {again.label}
            </button>
          )}
          <button className="btn btn-primary btn-lg accent-btn" onClick={() => go('play')}>
            <PlayIcon /> Play again
          </button>
        </RoundDone>
      </div>
    );
  }

  return (
    <div style={style} className="intro">
      <a href="#/" className="btn btn-ghost btn-sm back-link">
        <ArrowLeft size={16} /> All games
      </a>
      <div className="card intro-card">
        <div className="intro-head">
          <span className="game-icon lg">
            <game.Icon size={40} />
          </span>
          <div>
            <span className="skill-tag">{game.skill}</span>
            <h1>{game.title}</h1>
            <p className="muted">{game.tagline}</p>
          </div>
        </div>

        <div className="intro-measures">
          <TargetIcon />
          <div>
            <strong>What this measures</strong>
            <p>{game.measures}</p>
          </div>
        </div>

        <h2 className="intro-sub">How to play</h2>
        <ol className="howto">
          {game.howTo.map((s, i) => (
            <li key={i}>
              <span className="howto-num">{i + 1}</span>
              <span>{s}</span>
            </li>
          ))}
        </ol>

        <div className="intro-practice">
          <span className="practice-tag">Practice round</span>
          <p>{game.practice} Practice results are not saved.</p>
        </div>

        <div className="intro-foot">
          <span className="foot-item muted">
            <ClockIcon /> About {game.duration}
          </span>
          <div className="intro-buttons">
            <button className="btn btn-secondary btn-lg" onClick={() => go('play')}>
              Skip to real test
            </button>
            <button className="btn btn-primary btn-lg accent-btn" onClick={() => go('practice')}>
              <PlayIcon /> Start with practice
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
