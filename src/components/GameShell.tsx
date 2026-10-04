import { useState, type CSSProperties } from 'react';
import type { GameMeta, GameResult } from '../lib/types';
import { bestScore, gameHistory, saveResult } from '../lib/storage';
import { ArrowLeft, ClockIcon, PlayIcon, TargetIcon } from './Icons';
import ResultsView from './ResultsView';

export default function GameShell({ game }: { game: GameMeta }) {
  const [phase, setPhase] = useState<'intro' | 'play' | 'results'>('intro');
  const [run, setRun] = useState(0);
  const [result, setResult] = useState<GameResult | null>(null);
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

  function start() {
    setRun((n) => n + 1);
    setPhase('play');
    window.scrollTo(0, 0);
  }

  const style = { '--accent': game.accent } as CSSProperties;

  if (phase === 'results' && result)
    return (
      <div style={style}>
        <ResultsView game={game} result={result} prevBest={prevBest} prevPlays={prevPlays} onReplay={start} />
      </div>
    );

  if (phase === 'play')
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
            <span className="skill-tag">{game.skill}</span>
          </div>
          <span className="play-bar-spacer" />
        </div>
        <game.Component key={run} onFinish={finish} />
      </div>
    );

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

        <div className="intro-foot">
          <span className="foot-item muted">
            <ClockIcon /> About {game.duration}
          </span>
          <button className="btn btn-primary btn-lg accent-btn" onClick={start}>
            <PlayIcon /> Start game
          </button>
        </div>
      </div>
    </div>
  );
}
