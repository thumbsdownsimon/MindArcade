import type { GameMeta, GameResult, ResultChart } from '../lib/types';
import { CheckIcon, GridIcon, RetryIcon, TargetIcon, TrophyIcon } from './Icons';

function verdict(score: number) {
  if (score >= 85) return { title: 'Outstanding', text: 'A top-tier performance. You are operating at a very high level on this skill.' };
  if (score >= 70) return { title: 'Strong performance', text: 'Clearly above average. A few refinements will push you into the top tier.' };
  if (score >= 50) return { title: 'Solid result', text: 'A good, balanced performance with clear room to grow.' };
  if (score >= 30) return { title: 'Developing', text: 'You have the basics. Focus on the tips below and you will see quick gains.' };
  return { title: 'Getting started', text: 'Everyone starts somewhere. These games reward practice, so read the tips and give it another go.' };
}

function ScoreRing({ score }: { score: number }) {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="score-ring">
      <svg viewBox="0 0 120 120" width="140" height="140">
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--surface-2)" strokeWidth="11" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - score / 100)}
          transform="rotate(-90 60 60)"
          className="score-ring-arc"
          style={{ ['--dash' as string]: c }}
        />
      </svg>
      <div className="score-ring-text">
        <span className="score-ring-num">{score}</span>
        <span className="score-ring-of">/ 100</span>
      </div>
    </div>
  );
}

function BarChart({ chart }: { chart: ResultChart }) {
  return (
    <section className="card chart">
      <h3>{chart.title}</h3>
      {chart.note && <p className="muted small">{chart.note}</p>}
      <div className="chart-rows">
        {chart.bars.map((b, i) => (
          <div key={i} className="chart-row">
            <span className="chart-label">{b.label}</span>
            <span className="chart-track">
              <span style={{ width: `${Math.max(0, Math.min(100, (b.value / chart.max) * 100))}%`, animationDelay: `${i * 40}ms` }} />
            </span>
            <span className="chart-value">{b.display ?? Math.round(b.value)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

interface Props {
  game: GameMeta;
  result: GameResult;
  prevBest: number | null;
  prevPlays: number;
  onReplay: () => void;
}

export default function ResultsView({ game, result, prevBest, prevPlays, onReplay }: Props) {
  const v = verdict(result.score);
  const comparison =
    prevBest === null
      ? { cls: 'neutral', text: 'First attempt. This is your baseline.' }
      : result.score > prevBest
        ? { cls: 'good', text: `New personal best! Previous best: ${prevBest}` }
        : { cls: 'neutral', text: `Personal best: ${prevBest} · attempt #${prevPlays + 1}` };

  return (
    <div className="results">
      <section className="card results-hero">
        <ScoreRing score={result.score} />
        <div className="results-hero-text">
          <span className="skill-tag">
            {game.title} · {game.skill}
          </span>
          <h1>{v.title}</h1>
          <p className="muted">{v.text}</p>
          <span className={`compare-chip ${comparison.cls}`}>
            <TrophyIcon /> {comparison.text}
          </span>
        </div>
      </section>

      {result.profile && (
        <section className="card profile-card">
          <span className="eyebrow accent-text">Your style</span>
          <h2>{result.profile.name}</h2>
          <p>{result.profile.description}</p>
        </section>
      )}

      <section className="metrics-grid">
        {result.metrics.map((m) => (
          <div key={m.label} className="card metric">
            <div className="metric-value">{m.value}</div>
            <div className="metric-label">{m.label}</div>
            {m.hint && <div className="metric-hint">{m.hint}</div>}
          </div>
        ))}
      </section>

      <section className="feedback-grid">
        <div className="card feedback good">
          <h3>
            <span className="fb-icon">
              <CheckIcon />
            </span>
            What went well
          </h3>
          <ul>
            {result.strengths.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
        <div className="card feedback improve">
          <h3>
            <span className="fb-icon">
              <TargetIcon />
            </span>
            What to work on
          </h3>
          <ul>
            {result.improvements.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </div>
      </section>

      {result.chart && <BarChart chart={result.chart} />}

      <div className="results-actions">
        <button className="btn btn-primary btn-lg accent-btn" onClick={onReplay}>
          <RetryIcon /> Play again
        </button>
        <a className="btn btn-secondary btn-lg" href="#/">
          <GridIcon /> Choose another game
        </a>
      </div>
    </div>
  );
}
