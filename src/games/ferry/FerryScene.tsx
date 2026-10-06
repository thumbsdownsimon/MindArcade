import { useMemo, useRef, useState } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Label3D from '../../three/Label3D';
import * as THREE from 'three';
import Stage3D, { Lights } from '../../three/Stage3D';
import VoxelModel, { type Rig } from '../../three/VoxelModel';
import { box, mergeParts, type Model, type Part } from '../../three/voxel';
import { chicken, fox, larva, person, type PersonLook } from '../../three/models';
import { EATS, LABEL, type Kind, type Puzzle, type State } from './engine';

/* ---------- Layout (world units) ---------- */

const SHORE = 3.6; // water spans z ∈ (-SHORE, SHORE)
const BOAT_Z = [2.25, -2.25];
const BANK_Z = [5.3, -5.4];
const SLOT_GAP = 1.5;
const SEAT_GAP = 1.2;
export const SAIL_MS = 1500;

const raftWidth = (cap: number) => SEAT_GAP * (cap + 1) + 0.5;
const seatX = (cap: number, seat: number) => -raftWidth(cap) / 2 + 0.6 + SEAT_GAP * (seat + 1);
const slotX = (n: number, i: number) => (i - (n - 1) / 2) * SLOT_GAP;

/* ---------- Characters ---------- */

const ADULTS: PersonLook[] = [
  { skin: '#e0ac80', shirt: '#0d9488', pants: '#334155', hair: '#5b3a1e', beard: '#5b3a1e' },
  { skin: '#c68863', shirt: '#9333ea', pants: '#1e293b', hair: '#1c1917' },
  { skin: '#f2c7a5', shirt: '#ea580c', pants: '#3f3f46', hair: '#d6a35c', hat: 'cap', hatColor: '#2563eb' },
];
const KIDS: PersonLook[] = [
  { skin: '#f2c7a5', shirt: '#facc15', pants: '#2563eb', hair: '#b45309', kid: true, hat: 'bow', hatColor: '#ec4899' },
  { skin: '#c68863', shirt: '#22c55e', pants: '#475569', hair: '#1c1917', kid: true, hat: 'cap', hatColor: '#ef4444' },
  { skin: '#e0ac80', shirt: '#38bdf8', pants: '#7c2d12', hair: '#78350f', kid: true },
  { skin: '#8d5a3b', shirt: '#f472b6', pants: '#334155', hair: '#1c1917', kid: true, hat: 'bow', hatColor: '#a855f7' },
];
const SAILOR: PersonLook = { skin: '#e0ac80', shirt: '#f8fafc', stripe: '#1d4ed8', pants: '#1e3a8a', hair: '#57534e', beard: '#d6d3d1', hat: 'captain' };

interface Look {
  id: string;
  model: Model;
  scale: number;
  height: number;
}

/** Visual for entity `i` of a puzzle. Adults and kids get different outfits by their order. */
export function lookFor(kinds: Kind[], i: number): Look {
  const k = kinds[i];
  const nth = kinds.slice(0, i).filter((x) => x === k).length;
  switch (k) {
    case 'adult':
      return { id: `adult${nth % ADULTS.length}`, model: person(ADULTS[nth % ADULTS.length]), scale: 0.66, height: 1.38 };
    case 'kid':
      return { id: `kid${nth % KIDS.length}`, model: person(KIDS[nth % KIDS.length]), scale: 0.66, height: 1.08 };
    case 'fox':
      return { id: 'fox', model: fox(false), scale: 1.1, height: 1.1 };
    case 'blackfox':
      return { id: 'blackfox', model: fox(true), scale: 1.22, height: 1.22 };
    case 'chicken':
      return { id: 'chicken', model: chicken(), scale: 1.15, height: 0.98 };
    case 'larva':
      return { id: 'larva', model: larva(), scale: 1.75, height: 0.7 };
  }
}

const sailorModel = person(SAILOR);

type Place = { at: 'bank'; side: 0 | 1; slot: number } | { at: 'boat'; seat: number } | { at: 'eat'; prey: number };

const ease = (p: number) => (p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2);
const damp = (a: number, b: number, k: number, dt: number) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

interface CreatureProps {
  i: number;
  kind: Kind;
  look: Look;
  place: Place;
  getPos: (place: Place, out: THREE.Vector3) => THREE.Vector3;
  /** Index of prey on the same unguarded bank, which this predator stares at. */
  stalk: number | null;
  nervous: boolean;
  eaten: boolean;
  celebrate: boolean;
  hint: string;
  onPick: (i: number) => void;
  positions: React.MutableRefObject<THREE.Vector3[]>;
}

function Creature({ i, kind, look, place, getPos, stalk, nervous, eaten, celebrate, hint, onPick, positions }: CreatureProps) {
  const g = useRef<THREE.Group>(null);
  const rig = useRef<Rig>(null);
  const [hover, setHover] = useState(false);
  const key = place.at === 'bank' ? `b${place.side}` : place.at === 'boat' ? `s${place.seat}` : `e${place.prey}`;
  const anim = useRef({ key: '', from: new THREE.Vector3(), t0: 0, dur: 0, poke: -10, yaw: 0, scale: 1, seed: i * 1.7 });
  const tgt = useMemo(() => new THREE.Vector3(), []);
  const tmp = useMemo(() => new THREE.Vector3(), []);
  const isPerson = kind === 'adult' || kind === 'kid';
  const clock = useThree((s) => s.clock);

  useFrame(({ clock, camera }, dt) => {
    const grp = g.current;
    const r = rig.current;
    if (!grp || !r) return;
    const t = clock.elapsedTime;
    const a = anim.current;
    getPos(place, tgt);

    if (a.key !== key) {
      if (a.key === '') grp.position.copy(tgt);
      a.from.copy(grp.position);
      a.t0 = t;
      a.dur = a.key === '' ? 0 : THREE.MathUtils.clamp(a.from.distanceTo(tgt) / 4.2, 0.3, 1.1);
      a.key = key;
    }
    const p = a.dur ? Math.min(1, (t - a.t0) / a.dur) : 1;
    const moving = p < 1;
    grp.position.lerpVectors(a.from, tgt, ease(p));
    const dist = a.from.distanceTo(tgt);
    grp.position.y += Math.sin(Math.PI * p) * (0.35 + dist * 0.12);

    // Little hops for pokes and celebrations.
    const sincePoke = t - a.poke;
    if (sincePoke < 0.45) grp.position.y += Math.sin((sincePoke / 0.45) * Math.PI) * 0.3;
    if (celebrate && !moving) grp.position.y += Math.abs(Math.sin(t * 5 + a.seed)) * 0.35;
    if (nervous && !moving) grp.position.x += Math.sin(t * 40) * 0.015;
    positions.current[i] = grp.position;

    // Facing: along the hop while moving, otherwise towards the camera (or the prey when stalking).
    let yaw = Math.PI / 4 + 0.15 * Math.sin(t * 0.4 + a.seed); // face the 45° camera
    if (moving && dist > 0.2) yaw = Math.atan2(tgt.x - a.from.x, tgt.z - a.from.z);
    else if (stalk !== null && positions.current[stalk]) {
      tmp.copy(positions.current[stalk]).sub(grp.position);
      yaw = Math.atan2(tmp.x, tmp.z);
    } else if (hover) {
      tmp.copy(camera.position).sub(grp.position);
      yaw = Math.atan2(tmp.x, tmp.z);
    }
    a.yaw += wrap(yaw - a.yaw) * (1 - Math.exp(-10 * dt));
    grp.rotation.y = a.yaw;

    const s = eaten ? 0 : hover ? 1.08 : 1;
    a.scale = damp(a.scale, s, eaten ? 6 : 14, dt);
    grp.scale.setScalar(a.scale * look.scale);
    grp.visible = a.scale > 0.02;

    animateRig(kind, r, t + a.seed, { moving, poke: sincePoke < 0.8 ? sincePoke : -1, celebrate, stalk: stalk !== null, isPerson });
  });

  function click(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    if (e.delta > 6) return; // was a camera drag, not a click
    anim.current.poke = clock.elapsedTime;
    onPick(i);
  }

  return (
    <group
      ref={g}
      onClick={click}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = '';
      }}
    >
      <VoxelModel ref={rig} id={look.id} model={look.model} />
      {/* Generous invisible hit box so small animals are easy to click. */}
      <mesh position={[0, look.height / look.scale / 2, 0]}>
        <boxGeometry args={[1.1 / look.scale, look.height / look.scale, 1.1 / look.scale]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {hover && !eaten && (
        <Label3D position={[0, look.height / look.scale + 0.3 / look.scale, 0]} text={LABEL[kind]} sub={hint} />
      )}
    </group>
  );
}

interface AnimState {
  moving: boolean;
  /** Seconds since the player clicked this character, or -1. */
  poke: number;
  celebrate: boolean;
  stalk: boolean;
  isPerson: boolean;
}

function animateRig(kind: Kind, r: Rig, t: number, s: AnimState) {
  const walk = s.moving ? Math.sin(t * 16) : 0;
  if (s.isPerson) {
    r.legL.rotation.x = walk * 0.7;
    r.legR.rotation.x = -walk * 0.7;
    r.armL.rotation.x = -walk * 0.6;
    r.armR.rotation.x = walk * 0.6;
    let raiseR = 0.06 + Math.sin(t * 1.3) * 0.03;
    let raiseL = -raiseR;
    if (s.poke >= 0) raiseR = 2.5 + Math.sin(s.poke * 22) * 0.35; // wave
    if (s.celebrate) {
      raiseR = 2.7 + Math.sin(t * 10) * 0.2;
      raiseL = -raiseR;
    }
    r.armR.rotation.z = raiseR;
    r.armL.rotation.z = raiseL;
    r.head.rotation.y = Math.sin(t * 0.7) * 0.25;
    r.head.rotation.x = 0;
    return;
  }
  if (kind === 'fox' || kind === 'blackfox') {
    r.legFL.rotation.x = walk * 0.8;
    r.legBR.rotation.x = walk * 0.8;
    r.legFR.rotation.x = -walk * 0.8;
    r.legBL.rotation.x = -walk * 0.8;
    const wag = s.poke >= 0 ? 18 : s.stalk ? 2 : 3;
    r.tail.rotation.y = Math.sin(t * wag) * (s.poke >= 0 ? 0.6 : 0.3);
    r.tail.rotation.x = s.stalk ? 0.1 : -0.35;
    r.head.rotation.x = s.stalk ? 0.3 : Math.sin(t * 0.8) * 0.08;
    r.head.rotation.y = s.stalk ? 0 : Math.sin(t * 0.5) * 0.3;
    return;
  }
  if (kind === 'chicken') {
    r.legL.rotation.x = walk * 0.8;
    r.legR.rotation.x = -walk * 0.8;
    const flap = s.poke >= 0 || s.moving || s.celebrate ? Math.abs(Math.sin(t * 24)) * 1.1 : 0;
    r.wingL.rotation.z = -flap;
    r.wingR.rotation.z = flap;
    // Pecking now and then.
    const peck = Math.max(0, Math.sin(t * 1.4)) ** 8;
    r.head.rotation.x = peck * 0.9;
    r.head.rotation.y = Math.sin(t * 2.1) * 0.35 * (1 - peck);
    return;
  }
  // larva: a wave runs through the segments
  const speed = s.moving || s.poke >= 0 ? 14 : 3;
  const amp = s.moving || s.poke >= 0 ? 0.12 : 0.03;
  for (let k = 0; k < 4; k++) {
    const seg = r[`seg${k}`];
    if (seg) {
      seg.position.y = Math.max(0, Math.sin(t * speed - k * 1.2)) * amp;
      seg.rotation.y = Math.sin(t * speed * 0.5 - k) * 0.15;
    }
  }
}

/* ---------- Boat ---------- */

interface BoatProps {
  cap: number;
  side: number;
  sailing: boolean;
  busy: boolean;
  boatRef: React.MutableRefObject<THREE.Group | null>;
  onSail: () => void;
}

function Boat({ cap, side, sailing, busy, boatRef, onSail }: BoatProps) {
  const [hover, setHover] = useState(false);
  const sailorRig = useRef<Rig>(null);
  const tw = useRef({ side: -1, from: BOAT_Z[side], t0: 0 });
  const geo = useMemo(() => {
    const w = raftWidth(cap);
    const d = 1.7;
    const parts: Part[] = [];
    // logs
    for (let k = 0; k < 5; k++) parts.push(box([w, 0.22, d / 5 - 0.03], [0, -0.02, -d / 2 + (d / 5) * (k + 0.5)], k % 2 ? '#a16207' : '#92400e'));
    // planks on top and a railing
    parts.push(box([w - 0.1, 0.06, d - 0.15], [0, 0.11, 0], '#c08a4a'));
    for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) {
      parts.push(box([w, 0.06, 0.06], [0, 0.55, z], '#7c4a1e'));
      for (let x = -w / 2 + 0.1; x <= w / 2 - 0.05; x += w / Math.max(3, cap + 1) - 0.001) parts.push(box([0.07, 0.45, 0.07], [x, 0.34, z], '#7c4a1e'));
    }
    // empty seat markers
    for (let k = 0; k < cap; k++) parts.push(box([0.6, 0.02, 0.6], [seatX(cap, k), 0.15, 0], '#e7c58f'));
    // a little flag
    parts.push(box([0.06, 1.3, 0.06], [w / 2 - 0.15, 0.75, -d / 2 + 0.12], '#57534e'));
    parts.push(box([0.02, 0.32, 0.45], [w / 2 - 0.15, 1.24, -d / 2 + 0.37], '#ef4444'));
    return mergeParts(parts)!;
  }, [cap]);

  useFrame(({ clock }) => {
    const b = boatRef.current;
    if (!b) return;
    const t = clock.elapsedTime;
    const tw0 = tw.current;
    if (tw0.side !== side) {
      tw0.from = tw0.side === -1 ? BOAT_Z[side] : b.position.z;
      tw0.side = side;
      tw0.t0 = t;
    }
    const p = Math.min(1, (t - tw0.t0) / (SAIL_MS / 1000 - 0.1));
    b.position.z = THREE.MathUtils.lerp(tw0.from, BOAT_Z[side], ease(p));
    b.position.y = Math.sin(t * 1.7) * 0.04;
    b.rotation.z = Math.sin(t * 1.3) * 0.02;
    b.rotation.x = Math.sin(t * 1.1) * 0.015 + (p < 1 ? Math.sin(Math.PI * p) * 0.03 * Math.sign(tw0.from - BOAT_Z[side]) : 0);
    const r = sailorRig.current;
    if (r) {
      const row = sailing ? Math.sin(t * 7) : 0;
      r.armL.rotation.x = sailing ? -1.0 + row * 0.5 : 0;
      r.armR.rotation.x = sailing ? -1.0 + row * 0.5 : 0;
      r.armR.rotation.z = sailing ? 0.05 : 0.08;
      r.armL.rotation.z = sailing ? -0.05 : -0.08;
      r.body.rotation.x = sailing ? row * 0.06 : 0;
      r.head.rotation.y = Math.sin(t * 0.6) * 0.3;
    }
  });

  return (
    <group
      ref={boatRef}
      // Clicking the raft or the sailor sets sail. Passengers handle their own clicks first.
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        if (e.delta <= 6) onSail();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = '';
      }}
    >
      <mesh geometry={geo} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>
      <group position={[-raftWidth(cap) / 2 + 0.6, 0.14, 0]} scale={0.66}>
        <VoxelModel ref={sailorRig} id="sailor" model={sailorModel} />
      </group>
      {hover && (
        <Label3D
          position={[-raftWidth(cap) / 2 + 0.6, 1.9, 0]}
          text="Sailor"
          sub={busy ? 'wait…' : side === 0 ? 'click to sail across' : 'click to sail back'}
        />
      )}
      {/* oar */}
      <mesh position={[-raftWidth(cap) / 2 + 0.25, 0.25, 0.75]} rotation={[0.9, 0, 0.2]} castShadow>
        <boxGeometry args={[0.07, 0.07, 1.6]} />
        <meshStandardMaterial color="#7c4a1e" />
      </mesh>
    </group>
  );
}

/* ---------- Scenery ---------- */

function treeParts(x: number, z: number, h: number, leaf: string): Part[] {
  return [
    box([0.4, h, 0.4], [x, h / 2, z], '#7c4a1e'),
    box([1.6, 1.0, 1.6], [x, h + 0.3, z], leaf),
    box([1.1, 0.6, 1.1], [x, h + 1.0, z], leaf),
    box([0.6, 0.4, 0.6], [x + 0.5, h - 0.1, z + 0.5], leaf),
  ];
}

function useScenery() {
  return useMemo(() => {
    const ground: Part[] = [];
    const props: Part[] = [];
    // Banks: chunky grass blocks with a stepped, irregular shoreline.
    for (const side of [0, 1]) {
      const dir = side === 0 ? 1 : -1;
      const depth = side === 0 ? 14 : 22;
      ground.push(box([140, 0.3, depth], [0, -0.15, dir * (SHORE + 0.6 + depth / 2)], '#6fbf4a'));
      ground.push(box([140, 2, depth], [0, -1.3, dir * (SHORE + 0.6 + depth / 2)], '#8b5a2b'));
      for (let x = -70; x < 70; x += 1) {
        const jag = (Math.sin(x * 1.7 + side * 3) + Math.sin(x * 0.6)) * 0.25 + 0.3;
        ground.push(box([1, 0.3, 0.6 + jag], [x + 0.5, -0.15, dir * (SHORE + 0.6 - (0.6 + jag) / 2 + 0.3)], x % 2 ? '#6fbf4a' : '#66b343'));
        ground.push(box([1, 1.2, 0.6 + jag], [x + 0.5, -0.9, dir * (SHORE + 0.6 - (0.6 + jag) / 2 + 0.3)], '#a0703c'));
        if ((x * 7 + side * 3) % 5 === 0) props.push(box([0.5, 0.25, 0.5], [x + 0.5, -0.38, dir * (SHORE - 0.1)], '#9ca3af'));
      }
      // Dock planks reaching towards the boat.
      for (let k = -1; k <= 1; k++) props.push(box([0.6, 0.08, 1.3], [k * 0.62, 0.02, dir * (SHORE + 0.1)], k ? '#b07a3e' : '#c08a4a'));
      props.push(box([0.14, 0.7, 0.14], [-1, -0.05, dir * (SHORE - 0.4)], '#6b4423'), box([0.14, 0.7, 0.14], [1, -0.05, dir * (SHORE - 0.4)], '#6b4423'));
    }
    // Trees, bushes and flowers framing both banks, kept clear of the character slots.
    const trees: [number, number, number][] = [
      [-8.5, 6.2, 1.6], [8.8, 6.6, 2.0], [-10.5, 9, 1.8], [11, 9.5, 1.5],
      [-8, -7.2, 2.0], [-4.5, -9.5, 1.7], [-0.5, -10.5, 2.2], [3.8, -9.2, 1.6], [7.8, -7.4, 1.9], [11, -10, 2.1], [-12, -10, 1.6], [6, -13, 2.4], [-7, -13.5, 2.2],
    ];
    trees.forEach(([x, z, h], k) => props.push(...treeParts(x, z, h, k % 3 ? '#3f9b3a' : '#2f7d32')));
    const flowers = ['#f43f5e', '#facc15', '#a855f7', '#f8fafc'];
    for (let k = 0; k < 46; k++) {
      const side = k % 2;
      const x = ((k * 37) % 26) - 13 + Math.sin(k) * 0.4;
      const z = side ? -(SHORE + 4.4 + ((k * 13) % 6)) : SHORE + 3.6 + ((k * 11) % 4);
      if (Math.abs(x) < 5.4 && Math.abs(z) < 7.5) continue;
      props.push(box([0.12, 0.12, 0.12], [x, 0.06, z], flowers[k % 4]));
    }
    for (const [x, z] of [[-6.5, 7.5], [6.4, 7.8], [-9.5, -5.8], [9.6, -5.6]] as const) props.push(box([0.9, 0.6, 0.9], [x, 0.3, z], '#4d9f3c'), box([0.6, 0.4, 0.6], [x + 0.4, 0.5, z + 0.2], '#58ad45'));
    // Destination flag.
    props.push(box([0.12, 2.6, 0.12], [-6, 1.3, -6.8], '#e5e7eb'), box([0.05, 0.6, 1.0], [-6, 2.3, -6.3], '#22c55e'));
    return { ground: mergeParts(ground)!, props: mergeParts(props)! };
  }, []);
}

function Water() {
  const ripples = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const g = ripples.current;
    if (!g) return;
    g.children.forEach((c, k) => {
      c.position.x = (((clock.elapsedTime * (0.5 + (k % 3) * 0.2) + k * 7.3) % 60) + 60) % 60 - 30;
    });
  });
  return (
    <>
      <mesh position={[0, -0.32, 0]} rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[160, SHORE * 2 + 1.4]} />
        <meshStandardMaterial color="#2b8fd6" roughness={0.25} metalness={0.1} />
      </mesh>
      <group ref={ripples}>
        {Array.from({ length: 14 }, (_, k) => (
          <mesh key={k} position={[0, -0.29, -SHORE + 0.6 + ((k * 0.53) % (SHORE * 2 - 1.2))]}>
            <boxGeometry args={[1.2 + (k % 3) * 0.6, 0.02, 0.08]} />
            <meshBasicMaterial color="#bfe6ff" transparent opacity={0.55} />
          </mesh>
        ))}
      </group>
    </>
  );
}

function Poof({ at, color }: { at: THREE.Vector3; color: string }) {
  const g = useRef<THREE.Group>(null);
  const t0 = useRef<number | null>(null);
  const dirs = useMemo(() => Array.from({ length: 10 }, (_, k) => new THREE.Vector3(Math.cos(k * 2.4), 1.2 + (k % 3) * 0.5, Math.sin(k * 2.4))), []);
  useFrame(({ clock }) => {
    if (!g.current) return;
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = clock.elapsedTime - t0.current - 0.35;
    g.current.visible = t > 0 && t < 1;
    g.current.children.forEach((c, k) => {
      const d = dirs[k];
      c.position.set(d.x * t * 1.6, 0.4 + d.y * t - 2.2 * t * t, d.z * t * 1.6);
      c.rotation.set(t * 6, t * 4, 0);
    });
  });
  return (
    <group ref={g} position={at.clone()} visible={false}>
      {dirs.map((_, k) => (
        <mesh key={k}>
          <boxGeometry args={[0.1, 0.1, 0.1]} />
          <meshStandardMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

/* ---------- Scene ---------- */

export interface FerrySceneProps {
  puzzle: Puzzle;
  st: State;
  load: number[];
  sailing: boolean;
  boatSide: 0 | 1;
  eaten: [number, number] | null;
  celebrate: boolean;
  busy: boolean;
  onPick: (i: number) => void;
  onSail: () => void;
}

function Scene({ puzzle, st, load, sailing, boatSide, eaten, celebrate, busy, onPick, onSail }: FerrySceneProps) {
  const boatRef = useRef<THREE.Group | null>(null);
  const positions = useRef<THREE.Vector3[]>([]);
  const looks = useMemo(() => puzzle.kinds.map((_, i) => lookFor(puzzle.kinds, i)), [puzzle]);
  const scenery = useScenery();
  const n = puzzle.kinds.length;

  const getPos = (place: Place, out: THREE.Vector3) => {
    if (place.at === 'bank') return out.set(slotX(n, place.slot), 0, BANK_Z[place.side]);
    if (place.at === 'boat') {
      const b = boatRef.current;
      out.set(seatX(puzzle.capacity, place.seat), 0.14, 0);
      if (b) out.applyMatrix4(b.matrixWorld);
      return out;
    }
    const prey = positions.current[place.prey];
    return prey ? out.set(prey.x + 0.35, prey.y, prey.z + 0.2) : out;
  };

  const places: Place[] = puzzle.kinds.map((_, i) => {
    if (eaten && eaten[0] === i) return { at: 'eat', prey: eaten[1] };
    const seat = load.indexOf(i);
    if (seat >= 0) return { at: 'boat', seat };
    // Bank slots are keyed by entity index, so characters keep their spot across trips.
    return { at: 'bank', side: st.side[i], slot: i };
  });

  // Predators stare at prey on a bank the sailor isn't guarding.
  const guarded = sailing ? -1 : boatSide;
  const onBank = (i: number) => load.indexOf(i) < 0;
  const stalkOf = (i: number): number | null => {
    if (!onBank(i) || st.side[i] === guarded) return null;
    const prey = EATS[puzzle.kinds[i]];
    const victim = puzzle.kinds.findIndex((k, j) => j !== i && prey?.includes(k) && onBank(j) && st.side[j] === st.side[i]);
    return victim >= 0 ? victim : null;
  };
  const stalks = puzzle.kinds.map((_, i) => stalkOf(i));

  const hint = (i: number) => {
    if (busy) return 'wait…';
    if (load.includes(i)) return 'click to get off';
    if (st.side[i] === st.boat) return 'click to board';
    return 'boat is on the other side';
  };

  return (
    <>
      <color attach="background" args={['#bfe3fb']} />
      <fog attach="fog" args={['#bfe3fb', 22, 48]} />
      <Lights size={13} centre={[0, 0, -1]} sun={[7, 14, 9]} />
      <mesh geometry={scenery.ground} receiveShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <mesh geometry={scenery.props} castShadow receiveShadow>
        <meshStandardMaterial vertexColors roughness={0.9} />
      </mesh>
      <Water />
      <Boat cap={puzzle.capacity} side={boatSide} sailing={sailing} busy={busy} boatRef={boatRef} onSail={onSail} />
      {puzzle.kinds.map((k, i) => (
        <Creature
          key={i}
          i={i}
          kind={k}
          look={looks[i]}
          place={places[i]}
          getPos={getPos}
          stalk={stalks[i]}
          nervous={stalks.some((v) => v === i)}
          eaten={!!eaten && eaten[1] === i}
          celebrate={celebrate}
          hint={hint(i)}
          onPick={onPick}
          positions={positions}
        />
      ))}
      {eaten && positions.current[eaten[1]] && (
        <Poof key={`${eaten[0]}-${eaten[1]}`} at={positions.current[eaten[1]]} color={puzzle.kinds[eaten[1]] === 'larva' ? '#84cc16' : puzzle.kinds[eaten[1]] === 'chicken' ? '#f8fafc' : '#e8772e'} />
      )}
      <Label3D position={[-6, 3.3, -6.8]} text="Destination" className="label3d big" />
      <OrbitControls
        makeDefault
        target={[0, 0.3, 0.6]}
        enablePan={false}
        enableDamping
        minDistance={8}
        maxDistance={17}
        minAzimuthAngle={Math.PI / 4 - 0.65}
        maxAzimuthAngle={Math.PI / 4 + 0.65}
        minPolarAngle={0.55}
        maxPolarAngle={1.3}
      />
    </>
  );
}

export default function FerryScene(props: FerrySceneProps) {
  return (
    <Stage3D className="ferry-canvas" camera={{ position: [9.3, 7.4, 9.9], fov: 42 }} onPointerMissed={() => (document.body.style.cursor = '')}>
      <Scene {...props} />
    </Stage3D>
  );
}
