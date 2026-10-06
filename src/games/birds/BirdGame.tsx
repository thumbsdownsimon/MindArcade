import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import type { GameProps, GameResult } from '../../lib/types';
import { mean, pick, scale, shuffle, pct, secs } from '../../lib/util';
import { bird, type BirdLook } from '../../three/models';
import { flatParts, snapshot } from '../../three/voxel';
import ModelPreview from '../../three/ModelPreview';
import BirdScene, { MAX_DIST, MIN_DIST, placeBirds, type BirdSim, type CamState, type PopMsg } from './BirdScene';
import { COLS, ROWS, TILE, WORLD_D, WORLD_W, ZONE_NAME, ZONE_TILES, buildWorld, type World } from './world';
import './birds.css';

interface Species extends BirdLook {
  id: number;
  name: string;
}

interface ClickRec {
  t: number;
  correct: boolean;
}

const VIEW_H = 470;
const GAME_MS = 180_000;
const PER_SPECIES = 16;
const PLUS = 10;
const MINUS = 5;
const MINI_PX = 4; // minimap pixels per tile

const SPECIES: Species[] = [
  { id: 0, name: 'Crimson Crest', main: '#e11d48', dark: '#9f1239', crest: true },
  { id: 1, name: 'Ruby Finch', main: '#e11d48', dark: '#9f1239', crest: false },
  { id: 2, name: 'Blue Jay', main: '#2563eb', dark: '#1e3a8a', crest: true },
  { id: 3, name: 'Bluebird', main: '#2563eb', dark: '#1e3a8a', crest: false },
  { id: 4, name: 'Golden Crest', main: '#eab308', dark: '#a16207', crest: true },
  { id: 5, name: 'Canary', main: '#eab308', dark: '#a16207', crest: false },
];

const MODELS = SPECIES.map((s) => bird(s));

/** Side-on rendered picture of a species, for the HUD. */
function SpeciesIcon({ s, size }: { s: Species; size: number }) {
  const src = useMemo(() => snapshot(`bird-icon-${s.id}`, flatParts(MODELS[s.id]), { yaw: -1.25, pitch: 0.2, w: 128, h: 104 }), [s.id]);
  return src ? <img src={src} width={size} height={size * 0.8} alt="" style={{ display: 'block', objectFit: 'contain' }} /> : null;
}

function Minimap({ world, cam, found }: { world: World; cam: React.MutableRefObject<CamState>; found: { x: number; z: number }[] }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const view = useRef<HTMLSpanElement>(null);
  const s = MINI_PX / TILE; // minimap px per world unit

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    world.tileColor.forEach((c, i) => {
      ctx.fillStyle = c;
      ctx.fillRect((i % COLS) * MINI_PX, Math.floor(i / COLS) * MINI_PX, MINI_PX, MINI_PX);
    });
  }, [world]);

  // Follow the camera without re-rendering React every frame.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const v = view.current;
      if (v) {
        const c = cam.current;
        const w = c.dist * 1.5 * s;
        const h = c.dist * 1.0 * s;
        v.style.width = `${w}px`;
        v.style.height = `${h}px`;
        v.style.transform = `translate(${c.x * s - w / 2}px, ${c.z * s - h / 2}px) rotate(${-c.yaw}rad)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cam, s]);

  function jump(e: RPointerEvent<HTMLDivElement>) {
    const r = e.currentTarget.getBoundingClientRect();
    // Use the on-screen size, since the minimap is scaled down on small screens.
    cam.current.x = ((e.clientX - r.left) / r.width) * WORLD_W;
    cam.current.z = ((e.clientY - r.top) / r.height) * WORLD_D;
  }

  return (
    <div className="minimap" style={{ width: COLS * MINI_PX, height: ROWS * MINI_PX }} onPointerDown={(e) => { e.stopPropagation(); jump(e); }}>
      <canvas ref={canvas} width={COLS * MINI_PX} height={ROWS * MINI_PX} />
      {world.zones.map((z) => (
        <span key={z.kind} className="mini-zone" style={{ left: (z.col + 0.5) * ZONE_TILES * MINI_PX, top: (z.row + 0.5) * ZONE_TILES * MINI_PX }}>
          {ZONE_NAME[z.kind]}
        </span>
      ))}
      {found.map((f, i) => (
        <span key={i} className="mini-found" style={{ left: f.x * s, top: f.z * s }} />
      ))}
      <span ref={view} className="mini-view" />
    </div>
  );
}

export default function BirdGame({ onFinish }: GameProps) {
  const [world] = useState(buildWorld);
  const birds = useRef<BirdSim[]>([]);
  if (!birds.current.length) birds.current = placeBirds(world.perches, shuffle(SPECIES.flatMap((s) => Array(PER_SPECIES).fill(s.id) as number[])));
  const cam = useRef<CamState>({ x: WORLD_W / 2, z: WORLD_D / 2, yaw: 0, dist: 24 });
  const [target, setTarget] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [points, setPoints] = useState(0);
  const [pops, setPops] = useState<PopMsg[]>([]);
  const [found, setFound] = useState<{ x: number; z: number; species: number }[]>([]);
  const startT = useRef(0);
  const clicks = useRef<ClickRec[]>([]);
  const switches = useRef<{ t: number; dry: number }[]>([]);
  const lastFind = useRef(0);
  const ended = useRef(false);
  const popId = useRef(0);
  const started = target !== null;
  const targetRef = useRef(target);
  targetRef.current = target;

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
    onFinish(analyse(clicks.current, switches.current, e, birds.current));
  }

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

  // Called from the 3D scene's pointer handler, so it reads the target through a ref.
  function clickBird(id: number) {
    const b = birds.current[id];
    if (targetRef.current === null || ended.current || b.found) return;
    const correct = b.species === targetRef.current;
    const now = performance.now();
    clicks.current.push({ t: now - startT.current, correct });
    const pid = ++popId.current;
    setPops((p) => [...p, { id: pid, x: b.pos.x, y: b.pos.y, z: b.pos.z, text: correct ? `+${PLUS}` : `−${MINUS}`, ok: correct }]);
    window.setTimeout(() => setPops((p) => p.filter((x) => x.id !== pid)), 900);
    if (correct) {
      lastFind.current = now;
      b.found = true;
      setPoints((p) => p + PLUS);
      setFound((f) => [...f, { x: b.pos.x, z: b.pos.z, species: b.species }]);
    } else {
      b.wrongT = -1;
      setPoints((p) => p - MINUS);
    }
  }

  const nudge = (fn: (c: CamState) => void) => () => fn(cam.current);
  const foundOf = (s: number) => found.filter((f) => f.species === s).length;
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
              <SpeciesIcon s={tgt} size={34} />
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
        <div className="bird-viewport" style={{ height: VIEW_H }}>
          <BirdScene world={world} birds={birds} models={MODELS} cam={cam} onPick={clickBird} enabled={started} pops={pops} />

          <div className="cam-buttons">
            <button className="cam-btn" title="Rotate left (Q)" onClick={nudge((c) => (c.yaw += Math.PI / 4))}>⟲</button>
            <button className="cam-btn" title="Rotate right (E)" onClick={nudge((c) => (c.yaw -= Math.PI / 4))}>⟳</button>
            <button className="cam-btn" title="Zoom in (+)" onClick={nudge((c) => (c.dist = Math.max(MIN_DIST, c.dist * 0.75)))}>+</button>
            <button className="cam-btn" title="Zoom out (−)" onClick={nudge((c) => (c.dist = Math.min(MAX_DIST, c.dist / 0.75)))}>−</button>
          </div>

          <Minimap world={world} cam={cam} found={found} />

          {!started && (
            <div className="overlay">
              <div className="overlay-card">
                <span className="eyebrow">Bird watching</span>
                <h3>Find as many birds as you can</h3>
                <p>
                  You'll be given a random bird to look for. Correct birds earn +{PLUS}, wrong ones cost −{MINUS}. Birds hide in tree
                  tops, under trees, behind houses and in tall grass, so rotate and zoom to look around. You have 3 minutes.
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
                  <ModelPreview key={tgt.id} id={`bird-${tgt.id}`} model={MODELS[tgt.id]} height={0.9} distance={2.4} flap />
                </div>
                <strong className="your-bird-name">{tgt.name}</strong>
                <span className="muted small">Found {foundOf(tgt.id)}</span>
                <button className="btn btn-secondary" onClick={newBird}>
                  Give me a new bird
                </button>
              </>
            ) : (
              <span className="muted small">You'll get a random bird when you start. Other species are only revealed when you ask for a new bird.</span>
            )}
          </div>
          <p className="muted small">
            Drag to move · right-drag or Q/E to rotate · scroll to zoom · WASD/arrows also move. Click the minimap to jump.
          </p>
        </aside>
      </div>
    </div>
  );
}

/* ---------- Analysis ---------- */

function analyse(clicks: ClickRec[], switches: { t: number; dry: number }[], elapsedMs: number, birds: BirdSim[]): GameResult {
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
