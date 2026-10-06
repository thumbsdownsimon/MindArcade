import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import Stage3D from '../../three/Stage3D';
import VoxelModel, { type Rig } from '../../three/VoxelModel';
import Label3D from '../../three/Label3D';
import type { Model } from '../../three/voxel';
import { clamp } from '../../lib/util';
import { WATER_LEVEL, WORLD_D, WORLD_W, type Perch, type World } from './world';

export const BIRD_SCALE = 1.3;
export const MIN_DIST = 9;
export const MAX_DIST = 38;

/** Where the camera is looking. Mutated directly by controls, the minimap and buttons. */
export interface CamState {
  x: number;
  z: number;
  yaw: number;
  dist: number;
}

/** Per-bird simulation state, kept outside React so 100 birds can animate without re-rendering. */
export interface BirdSim {
  id: number;
  species: number;
  perch: number;
  pos: THREE.Vector3;
  yaw: number;
  seed: number;
  flight: { from: THREE.Vector3; to: number; t0: number; dur: number } | null;
  found: boolean;
  leaveT: number | null;
  wrongT: number | null;
}

/** Picks start-of-game perches for every bird, keeping them a little apart. */
export function placeBirds(perches: Perch[], species: number[]): BirdSim[] {
  const order = perches.map((_, i) => i).sort(() => Math.random() - 0.5);
  const taken: number[] = [];
  for (const i of order) {
    if (taken.length >= species.length) break;
    const p = perches[i];
    if (taken.every((j) => Math.hypot(perches[j].x - p.x, perches[j].z - p.z) > 1.4 || Math.abs(perches[j].y - p.y) > 1)) taken.push(i);
  }
  return taken.map((pi, id) => ({
    id,
    species: species[id],
    perch: pi,
    pos: new THREE.Vector3(perches[pi].x, perches[pi].y, perches[pi].z),
    yaw: Math.random() * Math.PI * 2,
    seed: Math.random() * 10,
    flight: null,
    found: false,
    leaveT: null,
    wrongT: null,
  }));
}

const pitchFor = (dist: number) => 0.72 + ((dist - MIN_DIST) / (MAX_DIST - MIN_DIST)) * 0.5;

/* ---------- Picking ---------- */

const ray = new THREE.Ray();
const sphere = new THREE.Sphere();
const hit = new THREE.Vector3();

function pickBird(r: THREE.Ray, birds: BirdSim[], occluders: THREE.Box3[]): number | null {
  let best: number | null = null;
  let bestT = Infinity;
  for (const b of birds) {
    if (b.found) continue;
    sphere.center.set(b.pos.x, b.pos.y + 0.4 * BIRD_SCALE, b.pos.z);
    sphere.radius = 0.62 * BIRD_SCALE;
    if (!r.intersectSphere(sphere, hit)) continue;
    const t = hit.distanceTo(r.origin);
    if (t >= bestT) continue;
    // Blocked if something solid sits between the camera and the bird (but not a bush the bird sits in).
    const blocked = occluders.some((o) => !o.containsPoint(sphere.center) && r.intersectBox(o, hit) && hit.distanceTo(r.origin) < t - 0.2);
    if (!blocked) {
      best = b.id;
      bestT = t;
    }
  }
  return best;
}

/* ---------- Camera ---------- */

function CameraRig({ cam, birds, world, models, onPick, enabled }: { cam: React.MutableRefObject<CamState>; birds: React.MutableRefObject<BirdSim[]>; world: World; models: Model[]; onPick: (id: number) => void; enabled: boolean }) {
  const { camera, gl } = useThree();
  const cur = useRef({ ...cam.current });
  const keys = useRef(new Set<string>());
  const hover = useRef<number | null>(null);
  const live = useRef({ onPick, enabled });
  live.current = { onPick, enabled };
  const raycaster = useMemo(() => new THREE.Raycaster(), []);

  useEffect(() => {
    const el = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let down: { x: number; y: number; t: number; button: number; shift: boolean } | null = null;
    let moved = false;
    let pinch: { d: number; a: number } | null = null;

    const rayAt = (cx: number, cy: number) => {
      const rect = el.getBoundingClientRect();
      raycaster.setFromCamera(new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1), camera);
      ray.copy(raycaster.ray);
      return ray;
    };
    const worldPerPixel = () => (2 * cur.current.dist * Math.tan(THREE.MathUtils.degToRad((camera as THREE.PerspectiveCamera).fov / 2))) / el.clientHeight;
    const pan = (dx: number, dy: number) => {
      const c = cam.current;
      const k = worldPerPixel();
      const s = Math.sin(c.yaw), co = Math.cos(c.yaw);
      // screen right = (cos, -sin), screen up (into the scene) = (-sin, -cos)
      c.x -= (co * dx - s * dy / Math.sin(pitchFor(c.dist))) * k;
      c.z -= (-s * dx - co * dy / Math.sin(pitchFor(c.dist))) * k;
    };
    const twoFinger = () => {
      const [a, b] = [...pointers.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y), a: Math.atan2(b.y - a.y, b.x - a.x) };
    };

    const onDown = (e: PointerEvent) => {
      el.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) pinch = twoFinger();
      down = { x: e.clientX, y: e.clientY, t: performance.now(), button: e.button, shift: e.shiftKey };
      moved = false;
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) {
        // Hover: highlight the bird under the cursor.
        const id = pickBird(rayAt(e.clientX, e.clientY), birds.current, world.occluders);
        hover.current = id;
        el.style.cursor = id !== null && live.current.enabled ? 'pointer' : 'grab';
        return;
      }
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      prev.x = e.clientX;
      prev.y = e.clientY;
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) moved = true;
      if (!moved) return;
      el.style.cursor = 'grabbing';
      if (pointers.size >= 2 && pinch) {
        const now = twoFinger();
        cam.current.dist = clamp(cam.current.dist * (pinch.d / now.d), MIN_DIST, MAX_DIST);
        cam.current.yaw -= now.a - pinch.a;
        pinch = now;
      } else if (down && (down.button === 2 || down.shift)) cam.current.yaw -= dx * 0.008;
      else pan(dx, dy);
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (down && !moved && e.button === 0 && performance.now() - down.t < 700 && live.current.enabled) {
        const id = pickBird(rayAt(e.clientX, e.clientY), birds.current, world.occluders);
        if (id !== null) live.current.onPick(id);
      }
      if (!pointers.size) {
        down = null;
        el.style.cursor = 'grab';
      }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cam.current.dist = clamp(cam.current.dist * Math.exp(e.deltaY * 0.0012), MIN_DIST, MAX_DIST);
    };
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!['arrowleft', 'arrowright', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd', 'q', 'e', '+', '=', '-'].includes(k)) return;
      if (e.type === 'keydown') {
        if (k.startsWith('arrow')) e.preventDefault();
        keys.current.add(k);
      } else keys.current.delete(k);
    };
    const noMenu = (e: Event) => e.preventDefault();
    const clear = () => keys.current.clear();
    el.style.cursor = 'grab';
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('contextmenu', noMenu);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', clear);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('contextmenu', noMenu);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', clear);
    };
  }, [gl, camera, cam, birds, world, raycaster]);

  useFrame((_, dt) => {
    const c = cam.current;
    const k = keys.current;
    if (k.size) {
      const speed = c.dist * 1.1 * dt;
      const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
      const rgt = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
      c.x += (-Math.sin(c.yaw) * f + Math.cos(c.yaw) * rgt) * speed;
      c.z += (-Math.cos(c.yaw) * f - Math.sin(c.yaw) * rgt) * speed;
      if (k.has('q')) c.yaw += dt * 1.6;
      if (k.has('e')) c.yaw -= dt * 1.6;
      if (k.has('+') || k.has('=')) c.dist = clamp(c.dist * Math.exp(-dt * 1.4), MIN_DIST, MAX_DIST);
      if (k.has('-')) c.dist = clamp(c.dist * Math.exp(dt * 1.4), MIN_DIST, MAX_DIST);
    }
    c.x = clamp(c.x, 4, WORLD_W - 4);
    c.z = clamp(c.z, 4, WORLD_D - 4);

    const s = cur.current;
    const a = 1 - Math.exp(-12 * dt);
    s.x += (c.x - s.x) * a;
    s.z += (c.z - s.z) * a;
    s.dist += (c.dist - s.dist) * a;
    s.yaw += (c.yaw - s.yaw) * a;
    const pitch = pitchFor(s.dist);
    camera.position.set(s.x + Math.sin(s.yaw) * Math.cos(pitch) * s.dist, Math.sin(pitch) * s.dist, s.z + Math.cos(s.yaw) * Math.cos(pitch) * s.dist);
    camera.lookAt(s.x, 0.5, s.z);
  });

  return <BirdFlock birds={birds} world={world} models={models} hover={hover} />;
}

/* ---------- Birds ---------- */

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);

function BirdFlock({ birds, world, models, hover }: { birds: React.MutableRefObject<BirdSim[]>; world: World; models: Model[]; hover: React.MutableRefObject<number | null> }) {
  const groups = useRef<(THREE.Group | null)[]>([]);
  const rigs = useRef<(Rig | null)[]>([]);
  const nextFlight = useRef(2);
  const occupied = useMemo(() => new Set(birds.current.map((b) => b.perch)), [birds]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const list = birds.current;

    // Now and then a bird hops over to a nearby free perch.
    if (t > nextFlight.current) {
      nextFlight.current = t + 0.7 + Math.random() * 0.9;
      const flying = list.filter((b) => b.flight).length;
      const idle = list.filter((b) => !b.flight && !b.found && b.id !== hover.current);
      if (flying < 6 && idle.length) {
        const b = idle[Math.floor(Math.random() * idle.length)];
        const options = world.perches
          .map((p, i) => ({ p, i, d: Math.hypot(p.x - b.pos.x, p.z - b.pos.z) }))
          .filter(({ i, d }) => d > 3 && d < 16 && !occupied.has(i));
        if (options.length) {
          const { i, d } = options[Math.floor(Math.random() * options.length)];
          occupied.delete(b.perch);
          occupied.add(i);
          b.perch = i;
          b.flight = { from: b.pos.clone(), to: i, t0: t, dur: 0.9 + d / 7 };
        }
      }
    }

    for (const b of list) {
      const g = groups.current[b.id];
      const r = rigs.current[b.id];
      if (!g || !r) continue;
      let flap = 0;
      let bob = 0;
      let pitch = 0;

      if (b.found) {
        // Correctly spotted birds fly up and away.
        if (b.leaveT === null) {
          b.leaveT = t;
          occupied.delete(b.perch);
        }
        const p = (t - b.leaveT) / 1.6;
        if (p >= 1) {
          g.visible = false;
          continue;
        }
        b.pos.y += 0.12 + p * 0.25;
        b.pos.x += Math.sin(b.yaw) * 0.12;
        b.pos.z += Math.cos(b.yaw) * 0.12;
        flap = Math.sin(t * 40);
        g.scale.setScalar(BIRD_SCALE * (1 - p * 0.6));
      } else if (b.flight) {
        const f = b.flight;
        const p = Math.min(1, (t - f.t0) / f.dur);
        const to = world.perches[f.to];
        const d = Math.hypot(to.x - f.from.x, to.z - f.from.z);
        b.pos.set(
          THREE.MathUtils.lerp(f.from.x, to.x, ease(p)),
          THREE.MathUtils.lerp(f.from.y, to.y, ease(p)) + Math.sin(Math.PI * p) * (1.6 + d * 0.15),
          THREE.MathUtils.lerp(f.from.z, to.z, ease(p)),
        );
        b.yaw = Math.atan2(to.x - f.from.x, to.z - f.from.z);
        flap = Math.sin(t * 38);
        pitch = -0.15;
        if (p >= 1) b.flight = null;
      } else {
        // Idle: peck, hop and look around.
        const ph = t * 0.8 + b.seed;
        const peck = Math.max(0, Math.sin(ph * 2.3)) ** 10;
        pitch = peck * 0.5;
        bob = Math.max(0, Math.sin(ph * 1.7 + 1)) ** 30 * 0.18;
        if (Math.sin(ph * 0.37) > 0.97) b.yaw += 0.02;
      }

      let yawWobble = 0;
      if (b.wrongT !== null) {
        if (b.wrongT < 0) b.wrongT = t; // the game sets -1 to mean "start shaking now"
        const p = (t - b.wrongT) / 0.5;
        if (p > 1) b.wrongT = null;
        else yawWobble = Math.sin(p * Math.PI * 6) * 0.5 * (1 - p);
      }

      g.position.set(b.pos.x, b.pos.y + bob, b.pos.z);
      g.rotation.set(pitch, b.yaw + yawWobble, 0);
      if (!b.found) g.scale.setScalar(BIRD_SCALE * (hover.current === b.id ? 1.18 : 1));
      r.wingL.rotation.z = -Math.abs(flap) * 1.2;
      r.wingR.rotation.z = Math.abs(flap) * 1.2;
    }
  });

  return (
    <>
      {birds.current.map((b) => (
        <group key={b.id} ref={(g) => { groups.current[b.id] = g; }} position={b.pos.toArray()} scale={BIRD_SCALE}>
          <VoxelModel ref={(r) => { rigs.current[b.id] = r; }} id={`bird-${b.species}`} model={models[b.species]} />
        </group>
      ))}
    </>
  );
}

/* ---------- Scene ---------- */

function SunFollow({ cam }: { cam: React.MutableRefObject<CamState> }) {
  const light = useRef<THREE.DirectionalLight>(null);
  useFrame(() => {
    const l = light.current;
    if (!l) return;
    const { x, z } = cam.current;
    l.position.set(x + 14, 30, z + 10);
    l.target.position.set(x, 0, z);
    l.target.updateMatrixWorld();
  });
  return (
    <directionalLight
      ref={light}
      intensity={2.3}
      castShadow
      shadow-mapSize={[2048, 2048]}
      shadow-bias={-0.0005}
      shadow-normalBias={0.03}
      shadow-camera-left={-34}
      shadow-camera-right={34}
      shadow-camera-top={34}
      shadow-camera-bottom={-34}
      shadow-camera-near={1}
      shadow-camera-far={90}
    />
  );
}

export interface PopMsg {
  id: number;
  x: number;
  y: number;
  z: number;
  text: string;
  ok: boolean;
}

interface SceneProps {
  world: World;
  birds: React.MutableRefObject<BirdSim[]>;
  models: Model[];
  cam: React.MutableRefObject<CamState>;
  onPick: (id: number) => void;
  enabled: boolean;
  pops: PopMsg[];
}

export default function BirdScene({ world, birds, models, cam, onPick, enabled, pops }: SceneProps) {
  return (
    <Stage3D className="bird-canvas" camera={{ position: [cam.current.x, 20, cam.current.z + 15], fov: 45, near: 0.5, far: 260 }}>
      <color attach="background" args={['#bde4f7']} />
      <fog attach="fog" args={['#bde4f7', 55, 120]} />
      <hemisphereLight args={['#e0f2fe', '#5f7f45', 1.3]} />
      <SunFollow cam={cam} />
      {/* Ground skirt so the map edge doesn't fall into the void. */}
      <mesh rotation-x={-Math.PI / 2} position={[WORLD_W / 2, -2.05, WORLD_D / 2]}>
        <planeGeometry args={[400, 400]} />
        <meshStandardMaterial color="#5c9442" />
      </mesh>
      <mesh geometry={world.terrain} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      {world.scenery.map((g, i) => (
        <mesh key={i} geometry={g} castShadow receiveShadow>
          <meshStandardMaterial vertexColors roughness={0.9} />
        </mesh>
      ))}
      {world.water.map((w, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[w.x, WATER_LEVEL, w.z]} receiveShadow>
          <planeGeometry args={[w.w, w.d]} />
          <meshStandardMaterial color="#3b9ae0" transparent opacity={0.82} roughness={0.2} metalness={0.1} />
        </mesh>
      ))}
      <CameraRig cam={cam} birds={birds} world={world} models={models} onPick={onPick} enabled={enabled} />
      {pops.map((p) => (
        <Label3D key={p.id} position={[p.x, p.y + 1.4, p.z]} text={p.text} className={`pop3d ${p.ok ? 'ok' : 'bad'}`} />
      ))}
    </Stage3D>
  );
}
