import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { GameProps, GameResult } from '../../lib/types';
import { clamp, mean, pick, randInt, scale, shuffle, pct, secs } from '../../lib/util';
import { useKeyDown } from '../../lib/hooks';
import './birds.css';

type BColor = 'red' | 'blue' | 'yellow';

interface Species {
  id: number;
  name: string;
  color: BColor;
  crest: boolean;
}

interface Bird {
  id: number;
  species: number;
  x: number;
  y: number;
  facing: 'left' | 'right';
  found: boolean;
}

interface Decor {
  kind: 'tree' | 'pine' | 'bush' | 'flower' | 'rock' | 'pond';
  x: number;
  y: number;
  size: number;
}

interface ClickRec {
  t: number;
  correct: boolean;
}

const WORLD_W = 2400;
const WORLD_H = 1600;
const VIEW_H = 430;
const GAME_MS = 180_000;
const PER_SPECIES = 11;
const MINI_SCALE = 0.06;
const PLUS = 10;
const MINUS = 5;

const SPECIES: Species[] = [
  { id: 0, name: 'Crimson Crest', color: 'red', crest: true },
  { id: 1, name: 'Ruby Finch', color: 'red', crest: false },
  { id: 2, name: 'Blue Jay', color: 'blue', crest: true },
  { id: 3, name: 'Bluebird', color: 'blue', crest: false },
  { id: 4, name: 'Golden Crest', color: 'yellow', crest: true },
  { id: 5, name: 'Canary', color: 'yellow', crest: false },
];

const COLORS: Record<BColor, [string, string]> = {
  red: ['#e11d48', '#9f1239'],
  blue: ['#2563eb', '#1e3a8a'],
  yellow: ['#eab308', '#a16207'],
};

export function BirdSvg({ color, crest, facing = 'right', size = 40 }: { color: BColor; crest: boolean; facing?: 'left' | 'right'; size?: number }) {
  const [main, dark] = COLORS[color];
  return (
    <svg viewBox="0 0 60 50" width={size} height={size * (50 / 60)} aria-hidden="true"
      style={{ transform: facing === 'left' ? 'scaleX(-1)' : undefined, display: 'block' }}>
      <path d="M8 30 L0 24 L2 36 Z" fill={dark} />
      <ellipse cx="26" cy="31" rx="17" ry="12" fill={main} />
      <ellipse cx="24" cy="29" rx="10" ry="6.5" fill={dark} opacity=".85" />
      <circle cx="42" cy="20" r="9" fill={main} />
      {crest && <path d="M37 13 L36 3 L41 10 L43 2 L45 11 L49 6 L46 15 Z" fill={dark} />}
      <path d="M50 18 L59 21 L50 24 Z" fill="#f59e0b" />
      <circle cx="45" cy="18" r="2.6" fill="#fff" />
      <circle cx="45.8" cy="18" r="1.4" fill="#0f172a" />
      <path d="M22 43 L22 48 M30 43 L30 48" stroke="#78350f" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function buildWorld() {
  const decor: Decor[] = [];
  for (let i = 0; i < 5; i++) decor.push({ kind: 'pond', x: randInt(150, WORLD_W - 350), y: randInt(150, WORLD_H - 250), size: randInt(160, 280) });
  for (let i = 0; i < 70; i++)
    decor.push({
      kind: pick(['tree', 'tree', 'pine', 'bush', 'bush', 'flower', 'rock'] as const),
      x: randInt(20, WORLD_W - 60),
      y: randInt(20, WORLD_H - 60),
      size: randInt(34, 64),
    });
  const birds: Bird[] = [];
  const order = shuffle(SPECIES.flatMap((s) => Array(PER_SPECIES).fill(s.id) as number[]));
  for (const species of order) {
    let x = 0, y = 0;
    for (let tries = 0; tries < 200; tries++) {
      x = randInt(40, WORLD_W - 60);
      y = randInt(40, WORLD_H - 60);
      if (birds.every((b) => Math.hypot(b.x - x, b.y - y) > 75)) break;
    }
    birds.push({ id: birds.length, species, x, y, facing: pick(['left', 'right'] as const), found: false });
  }
  return { decor, birds };
}

const DECOR_EMOJI = { tree: '🌳', pine: '🌲', bush: '🌿', flower: '🌼', rock: '🪨' };

export default function BirdGame({ onFinish }: GameProps) {
  const [world] = useState(buildWorld);
  const [birds, setBirds] = useState(world.birds);
  const [target, setTarget] = useState<number | null>(null);
  const [pos, setPos] = useState({ x: WORLD_W / 2 - 450, y: WORLD_H / 2 - VIEW_H / 2 });
  const [viewW, setViewW] = useState(900);
  const [elapsed, setElapsed] = useState(0);
  const [points, setPoints] = useState(0);
  const [pops, setPops] = useState<{ id: number; x: number; y: number; text: string; ok: boolean }[]>([]);
  const [wrongId, setWrongId] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const viewRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ sx: number; sy: number; px: number; py: number; moved: boolean } | null>(null);
  const startT = useRef(0);
  const clicks = useRef<ClickRec[]>([]);
  const switches = useRef<{ t: number; dry: number }[]>([]);
  const lastFind = useRef(0);
  const ended = useRef(false);
  const popId = useRef(0);
  const started = target !== null;

  const clampPos = (x: number, y: number, w = viewW) => ({
    x: clamp(x, 0, Math.max(0, WORLD_W - w)),
    y: clamp(y, 0, WORLD_H - VIEW_H),
  });

  useLayoutEffect(() => {
    const el = viewRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setViewW(el.clientWidth);
      setPos((p) => clampPos(p.x, p.y, el.clientWidth));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return;
    const iv = window.setInterval(() => {
      const e = performance.now() - startT.current;
      setElapsed(e);
      if (e >= GAME_MS) finish();
    }, 200);
    return () => clearInterval(iv);
  }, [started]);

  function finish() {
    if (ended.current) return;
    ended.current = true;
    const e = Math.min(GAME_MS, performance.now() - startT.current);
    onFinish(analyse(clicks.current, switches.current, e, birdsRef.current));
  }
  const birdsRef = useRef(birds);
  birdsRef.current = birds;

  function chooseTarget(id: number) {
    if (ended.current || id === target) return;
    const now = performance.now();
    if (target === null) {
      startT.current = now;
      lastFind.current = now;
    } else {
      switches.current.push({ t: now - startT.current, dry: now - lastFind.current });
      lastFind.current = now; // a new search starts
    }
    setTarget(id);
  }

  /** Assigns a random species different from the current one. */
  function newBird() {
    chooseTarget(pick(SPECIES.filter((s) => s.id !== target)).id);
  }

  function clickBird(b: Bird) {
    if (!started || ended.current || b.found || drag.current?.moved) return;
    const correct = b.species === target;
    const now = performance.now();
    clicks.current.push({ t: now - startT.current, correct });
    const pid = ++popId.current;
    setPops((p) => [...p, { id: pid, x: b.x, y: b.y, text: correct ? `+${PLUS}` : `−${MINUS}`, ok: correct }]);
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== pid)), 900);
    if (correct) {
      lastFind.current = now;
      setPoints((p) => p + PLUS);
      setBirds((bs) => bs.map((x) => (x.id === b.id ? { ...x, found: true } : x)));
    } else {
      setPoints((p) => p - MINUS);
      setWrongId(b.id);
      window.setTimeout(() => setWrongId((w) => (w === b.id ? null : w)), 450);
    }
  }

  function onPointerDown(e: RPointerEvent) {
    if (e.button !== 0) return;
    drag.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y, moved: false };
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = ev.clientX - d.sx;
      const dy = ev.clientY - d.sy;
      if (!d.moved && Math.hypot(dx, dy) > 5) {
        d.moved = true;
        setDragging(true);
      }
      if (d.moved) setPos(clampPos(d.px - dx, d.py - dy));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      setDragging(false);
      // Let the click event (which fires after pointerup) see `moved`, then clear.
      window.setTimeout(() => (drag.current = null), 0);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  useKeyDown((e) => {
    const step = 90;
    const k = e.key.toLowerCase();
    const d = { arrowleft: [-step, 0], a: [-step, 0], arrowright: [step, 0], d: [step, 0], arrowup: [0, -step], w: [0, -step], arrowdown: [0, step], s: [0, step] }[k];
    if (d) {
      e.preventDefault();
      setPos((p) => clampPos(p.x + d[0], p.y + d[1]));
    }
  });

  function jumpMini(e: RPointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    const wx = (e.clientX - r.left) / MINI_SCALE;
    const wy = (e.clientY - r.top) / MINI_SCALE;
    setPos(clampPos(wx - viewW / 2, wy - VIEW_H / 2));
  }

  const foundOf = (s: number) => birds.filter((b) => b.species === s && b.found).length;
  const remaining = Math.max(0, GAME_MS - elapsed);
  const correct = clicks.current.filter((c) => c.correct).length;
  const wrong = clicks.current.length - correct;
  const tgt = target === null ? null : SPECIES[target];

  return (
    <div className="stage birds-stage">
      <div className="hud">
        <div className="hud-group">
          <span className="pill">
            Time <strong>{`${Math.floor(Math.ceil(remaining / 1000) / 60)}:${String(Math.ceil(remaining / 1000) % 60).padStart(2, '0')}`}</strong>
          </span>
          <span className="pill pill-accent">
            Points <strong>{points}</strong>
          </span>
          <span className="pill">✓ {correct}</span>
          <span className="pill">✗ {wrong}</span>
        </div>
        <div className="hud-group">
          {tgt && (
            <span className="target-chip">
              <span className="muted small">Looking for</span>
              <BirdSvg color={tgt.color} crest={tgt.crest} size={30} />
              <strong>{tgt.name}</strong>
            </span>
          )}
          {started && (
            <button className="btn btn-ghost btn-sm" onClick={finish}>
              Finish now
            </button>
          )}
        </div>
      </div>

      <div className="birds-layout">
        <div
          ref={viewRef}
          className={`bird-viewport ${dragging ? 'is-dragging' : ''}`}
          style={{ height: VIEW_H }}
          onPointerDown={onPointerDown}
        >
          <div className="bird-world" style={{ width: WORLD_W, height: WORLD_H, transform: `translate(${-pos.x}px, ${-pos.y}px)` }}>
            {world.decor.map((d, i) =>
              d.kind === 'pond' ? (
                <div key={i} className="map-pond" style={{ left: d.x, top: d.y, width: d.size, height: d.size * 0.6 }} />
              ) : (
                <span key={i} className="map-decor" style={{ left: d.x, top: d.y, fontSize: d.size }}>
                  {DECOR_EMOJI[d.kind]}
                </span>
              ),
            )}
            {birds.map((b) => {
              const s = SPECIES[b.species];
              return (
                <button
                  key={b.id}
                  className={`map-bird ${b.found ? 'is-found' : ''} ${wrongId === b.id ? 'is-wrong' : ''}`}
                  style={{ left: b.x, top: b.y }}
                  onClick={() => clickBird(b)}
                  aria-label="Bird"
                >
                  <BirdSvg color={s.color} crest={s.crest} facing={b.facing} size={38} />
                  {b.found && <span className="found-check">✓</span>}
                </button>
              );
            })}
            {pops.map((p) => (
              <span key={p.id} className={`score-pop ${p.ok ? 'ok' : 'bad'}`} style={{ left: p.x + 18, top: p.y - 6 }}>
                {p.text}
              </span>
            ))}
          </div>

          <div className="minimap" onPointerDown={(e) => { e.stopPropagation(); jumpMini(e); }}
            style={{ width: WORLD_W * MINI_SCALE, height: WORLD_H * MINI_SCALE }}>
            {world.decor.filter((d) => d.kind === 'pond').map((d, i) => (
              <span key={i} className="mini-pond" style={{ left: d.x * MINI_SCALE, top: d.y * MINI_SCALE, width: d.size * MINI_SCALE, height: d.size * 0.6 * MINI_SCALE }} />
            ))}
            {birds.filter((b) => b.found).map((b) => (
              <span key={b.id} className="mini-found" style={{ left: b.x * MINI_SCALE, top: b.y * MINI_SCALE }} />
            ))}
            <span className="mini-view" style={{ left: pos.x * MINI_SCALE, top: pos.y * MINI_SCALE, width: viewW * MINI_SCALE, height: VIEW_H * MINI_SCALE }} />
          </div>

          {!started && (
            <div className="overlay" onPointerDown={(e) => e.stopPropagation()}>
              <div className="overlay-card">
                <span className="eyebrow">Bird watching</span>
                <h3>Find as many birds as you can</h3>
                <p>
                  You'll be given a random bird to look for. Correct birds earn +{PLUS}, wrong ones cost −{MINUS}. Ask for a new
                  bird whenever you like. You have 3 minutes.
                </p>
                <button className="btn btn-primary" onClick={newBird}>
                  Start spotting
                </button>
              </div>
            </div>
          )}
        </div>

        <aside className="species-panel">
          <div className="your-bird">
            <div className="species-title">Your bird</div>
            {tgt ? (
              <>
                <div className="your-bird-img">
                  <BirdSvg color={tgt.color} crest={tgt.crest} size={84} />
                </div>
                <strong className="your-bird-name">{tgt.name}</strong>
                <span className="muted small">
                  {tgt.crest ? 'Has a crest' : 'No crest'} · found {foundOf(tgt.id)}
                </span>
                <button className="btn btn-secondary" onClick={newBird}>
                  🔄 Give me a new bird
                </button>
              </>
            ) : (
              <span className="muted small">You'll get a random bird when you start.</span>
            )}
          </div>
          <div className="species-title">Field guide</div>
          <div className="guide">
            {SPECIES.map((s) => (
              <div key={s.id} className={`species ${target === s.id ? 'is-active' : ''}`}>
                <span className="species-img">
                  <BirdSvg color={s.color} crest={s.crest} size={32} />
                </span>
                <span className="species-info">
                  <strong>{s.name}</strong>
                  <span className="muted small">found {foundOf(s.id)}</span>
                </span>
              </div>
            ))}
          </div>
          <p className="muted small">Drag the map or use the arrow keys / WASD. Click the minimap to jump.</p>
        </aside>
      </div>
    </div>
  );
}

/* ---------- Analysis ---------- */

function analyse(clicks: ClickRec[], switches: { t: number; dry: number }[], elapsedMs: number, birds: Bird[]): GameResult {
  const correct = clicks.filter((c) => c.correct).length;
  const wrong = clicks.length - correct;
  const acc = clicks.length ? correct / clicks.length : 0;
  const minutes = Math.max(elapsedMs / 60000, 0.25);
  const perMin = correct / minutes;
  const points = correct * PLUS - wrong * MINUS;
  const findTimes = clicks.filter((c) => c.correct).map((c) => c.t);
  const gaps = findTimes.map((t, i) => t - (i ? findTimes[i - 1] : 0));
  const avgGap = mean(gaps);
  const avgDry = mean(switches.map((s) => s.dry));
  const speciesFound = new Set(birds.filter((b) => b.found).map((b) => b.species)).size;

  const score = Math.round(100 * (0.5 * scale(acc, 0.6, 1) + 0.5 * scale(perMin, 2, 12)));

  const fast = perMin >= 7;
  const accurate = acc >= 0.85;
  const profile = fast
    ? accurate
      ? { name: 'Sharp Spotter', description: 'You combine speed and accuracy, the sweet spot of the speed–accuracy trade-off. You scan efficiently and only click when you are sure.' }
      : { name: 'Speed Seeker', description: 'You favour speed. You find a lot of birds, but some clicks are guesses that cost you points. A split-second check before clicking would raise your score.' }
    : accurate
      ? { name: 'Careful Observer', description: 'You favour accuracy. You rarely click the wrong bird, but your careful style means fewer finds in the time available.' }
      : { name: 'Still Calibrating', description: "You haven't found your balance between speed and accuracy yet. A systematic scanning route over the map will help with both." };

  const strengths: string[] = [];
  const improvements: string[] = [];

  if (accurate && clicks.length >= 5) strengths.push(`Strong accuracy: ${pct(acc)} of your clicks were the right bird.`);
  if (fast) strengths.push(`Quick spotting: ${perMin.toFixed(1)} correct birds per minute.`);
  if (wrong === 0 && correct > 0) strengths.push('Not a single wrong click. You always checked the crest and colour.');
  if (switches.length >= 1 && avgDry < 25000) strengths.push('You switched species at sensible moments, when your current search dried up.');
  if (speciesFound >= 4) strengths.push(`You found ${speciesFound} different species, so you adapted your search target well.`);

  if (wrong >= 4)
    improvements.push(`${wrong} wrong clicks cost you ${wrong * MINUS} points. Several species share a colour and differ only in the crest, so check both before clicking.`);
  if (!fast)
    improvements.push(`You averaged ${secs(avgGap || elapsedMs)} between finds. Sweep the map in a fixed pattern (row by row) so you don't revisit areas you have already scanned.`);
  if (switches.length === 0 && correct > 0)
    improvements.push('You never switched bird. When one species gets hard to find, switching to another can be a faster way to earn points.');
  if (switches.length > 0 && avgDry > 40000)
    improvements.push(`You searched about ${secs(avgDry)} without a find before switching. Consider switching sooner when a search goes cold.`);
  if (switches.length >= 10) improvements.push(`You switched species ${switches.length} times. Frequent switching resets your "search image". Stick with a bird a little longer.`);

  if (!strengths.length) strengths.push('You explored the map and kept looking until the end.');
  if (!improvements.length) improvements.push('A superb balance. To push further, aim for over 10 correct birds per minute without losing accuracy.');

  const buckets = Array.from({ length: 6 }, (_, i) => clicks.filter((c) => c.correct && c.t >= i * 30000 && c.t < (i + 1) * 30000).length);
  return {
    score,
    profile,
    metrics: [
      { label: 'Points', value: String(points) },
      { label: 'Correct birds', value: String(correct) },
      { label: 'Wrong clicks', value: String(wrong) },
      { label: 'Accuracy', value: clicks.length ? pct(acc) : 'n/a' },
      { label: 'Finds per minute', value: perMin.toFixed(1) },
      { label: 'Species switches', value: String(switches.length), hint: switches.length ? `Avg ${secs(avgDry)} without a find before switching` : undefined },
    ],
    strengths,
    improvements,
    chart: {
      title: 'Correct birds found per 30 seconds',
      max: Math.max(...buckets, 1) * 1.2,
      note: 'Shows how your pace developed. A drop often means the current species was getting scarce.',
      bars: buckets.map((v, i) => ({ label: `${i * 0.5}–${(i + 1) * 0.5} min`, value: v, display: `${v} birds` })),
    },
  };
}
