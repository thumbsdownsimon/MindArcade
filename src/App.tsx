import { GAMES } from './games/registry';
import { useHashRoute } from './lib/hooks';
import { GridIcon, LogoMark } from './components/Icons';
import Landing from './components/Landing';
import GameShell from './components/GameShell';

export default function App() {
  const route = useHashRoute();
  const game = route.startsWith('/play/') ? GAMES.find((g) => g.id === route.slice('/play/'.length)) : undefined;

  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <a href="#/" className="brand">
            <span className="brand-mark">
              <LogoMark size={18} />
            </span>
            MindArcade
          </a>
          <nav className="nav">
            <a href="#/">
              <GridIcon size={16} /> All games
            </a>
          </nav>
        </div>
      </header>
      <main className="main">
        <div className="container">{game ? <GameShell key={game.id} game={game} /> : <Landing />}</div>
      </main>
      <footer className="footer">
        <div className="container footer-inner">
          <span>MindArcade · cognitive games for fun and practice</span>
          <span>Inspired by game-based assessments. Not a validated psychometric test.</span>
        </div>
      </footer>
    </div>
  );
}
