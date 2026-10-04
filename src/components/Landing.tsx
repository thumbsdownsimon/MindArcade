import type { CSSProperties } from 'react';
import { GAMES } from '../games/registry';
import { clearHistory, loadHistory } from '../lib/storage';
import { mean } from '../lib/util';
import { useState } from 'react';
import { ArrowRight, ClockIcon, PlayIcon, TrophyIcon } from './Icons';

export default function Landing() {
  // Ignore saved results from games that no longer exist (e.g. the removed Pitch Game).
  const [history, setHistory] = useState(() => loadHistory().filter((h) => GAMES.some((g) => g.id === h.gameId)));
  const played = new Set(history.map((h) => h.gameId));
  const avg = history.length ? Math.round(mean(history.map((h) => h.score))) : null;
  const recent = [...history].reverse().slice(0, 6);
  const next = GAMES.find((g) => !played.has(g.id)) ?? GAMES[0];

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">Game-based cognitive training</span>
          <h1>Play four short games. Learn how your mind works.</h1>
          <p>
            Each game targets one cognitive skill: problem solving, flexibility, speed versus accuracy, and
            learning. After every round you get a personal breakdown of how you did and what to work on next.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary btn-lg" href={`#/play/${next.id}`}>
              <PlayIcon /> {played.size ? `Play ${next.title}` : 'Start with the Ferry Game'}
            </a>
            <button
              className="btn btn-secondary btn-lg"
              onClick={() => document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' })}
            >
              Browse games
            </button>
          </div>
        </div>
        <div className="card stats-card">
          <div className="stats-title">Your progress</div>
          <div className="stats-row">
            <div className="stat">
              <span className="stat-value">{history.length}</span>
              <span className="stat-label">Games played</span>
            </div>
            <div className="stat">
              <span className="stat-value">{avg ?? '—'}</span>
              <span className="stat-label">Average score</span>
            </div>
            <div className="stat">
              <span className="stat-value">
                {played.size}
                <small>/{GAMES.length}</small>
              </span>
              <span className="stat-label">Skills tested</span>
            </div>
          </div>
          <div className="skill-bars">
            {GAMES.map((g) => {
              const scores = history.filter((h) => h.gameId === g.id).map((h) => h.score);
              const best = scores.length ? Math.max(...scores) : 0;
              return (
                <div key={g.id} className="skill-bar" style={{ '--accent': g.accent } as CSSProperties}>
                  <span className="skill-bar-label">{g.skill}</span>
                  <span className="skill-bar-track">
                    <span style={{ width: `${best}%` }} />
                  </span>
                  <span className="skill-bar-val">{scores.length ? best : '–'}</span>
                </div>
              );
            })}
          </div>
          <p className="muted small">Bars show your best score per skill. Results are saved in this browser only.</p>
        </div>
      </section>

      <section id="games">
        <div className="section-head">
          <div>
            <h2>Choose a game</h2>
            <p className="muted">Each takes a few minutes. Play them in any order.</p>
          </div>
        </div>
        <div className="game-grid">
          {GAMES.map((g) => {
            const scores = history.filter((h) => h.gameId === g.id).map((h) => h.score);
            return (
              <a key={g.id} href={`#/play/${g.id}`} className="card game-card" style={{ '--accent': g.accent } as CSSProperties}>
                <div className="game-card-top">
                  <span className="game-icon">
                    <g.Icon size={28} />
                  </span>
                  <span className="skill-tag">{g.skill}</span>
                </div>
                <h3>{g.title}</h3>
                <p>{g.tagline}</p>
                <div className="game-card-foot">
                  <span className="foot-item">
                    <ClockIcon /> {g.duration}
                  </span>
                  <span className="foot-item">
                    <TrophyIcon /> {scores.length ? <strong>Best {Math.max(...scores)}</strong> : 'Not played yet'}
                  </span>
                  <span className="game-card-go">
                    <ArrowRight />
                  </span>
                </div>
              </a>
            );
          })}
        </div>
      </section>

      {recent.length > 0 && (
        <section className="recent">
          <div className="section-head">
            <h2>Recent results</h2>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => {
                clearHistory();
                setHistory([]);
              }}
            >
              Clear history
            </button>
          </div>
          <div className="card recent-list">
            {recent.map((h, i) => {
              const g = GAMES.find((x) => x.id === h.gameId);
              if (!g) return null;
              return (
                <div key={i} className="recent-row" style={{ '--accent': g.accent } as CSSProperties}>
                  <span className="game-icon sm">
                    <g.Icon size={18} />
                  </span>
                  <div className="recent-main">
                    <strong>{g.title}</strong>
                    <span className="muted small">
                      {h.profile ? `${h.profile} · ` : ''}
                      {new Date(h.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                  </div>
                  <span className="recent-score">{h.score}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
