import { useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import Stage3D, { Lights } from '../../three/Stage3D';
import Label3D from '../../three/Label3D';
import { box, mergeParts, voxelMaterial, type Part } from '../../three/voxel';
import type { Pegs } from './engine';

const BS = 0.78; // block size
const GAP = 1.75; // distance between pegs
const BASE_H = 0.3;

export const BLOCKS = [
  { name: 'red', main: '#e23b3b', light: '#f87171', mark: 'dot' },
  { name: 'blue', main: '#2563eb', light: '#60a5fa', mark: null },
  { name: 'yellow', main: '#f5c518', light: '#fde68a', mark: null },
  { name: 'green', main: '#16a34a', light: '#4ade80', mark: 'stripes' },
] as const;

const pegX = (i: number, n: number) => (i - (n - 1) / 2) * GAP;
const levelY = (k: number) => BASE_H + BS / 2 + k * BS + 0.01;
const pegHeight = (cap: number) => cap * BS + 0.35;

/** A chunky block with bevelled edges and a marking so red and green also differ by pattern. */
function blockGeometry(id: number) {
  const b = BLOCKS[id];
  const s = BS;
  const parts: Part[] = [box([s, s, s], [0, 0, 0], b.main)];
  // lighter inset panel on the four sides and the top
  for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]] as const) {
    const size: [number, number, number] = dx ? [0.02, s * 0.66, s * 0.66] : [s * 0.66, s * 0.66, 0.02];
    parts.push(box(size, [(dx * s) / 2, 0, (dz * s) / 2], b.light));
    if (b.mark === 'dot') parts.push(box(dx ? [0.03, s * 0.22, s * 0.22] : [s * 0.22, s * 0.22, 0.03], [(dx * s) / 2, 0, (dz * s) / 2], '#7f1d1d'));
    if (b.mark === 'stripes')
      for (const o of [-0.17, 0.17])
        parts.push(dx ? box([0.03, s * 0.66, 0.07], [(dx * s) / 2, 0, o], '#14532d') : box([0.07, s * 0.66, 0.03], [o, 0, (dz * s) / 2], '#14532d'));
  }
  parts.push(box([s * 0.66, 0.02, s * 0.66], [0, s / 2, 0], b.light));
  return mergeParts(parts)!;
}

function Block({ id, target, lifted, liftY, onClick }: { id: number; target: THREE.Vector3; lifted: boolean; liftY: number; onClick?: (e: ThreeEvent<MouseEvent>) => void }) {
  const ref = useRef<THREE.Mesh>(null);
  const geo = useMemo(() => blockGeometry(id), [id]);
  const init = useRef(false);
  useFrame((_, dt) => {
    const m = ref.current;
    if (!m) return;
    if (!init.current) {
      m.position.copy(target);
      init.current = true;
    }
    const k = 1 - Math.exp(-14 * dt);
    const farX = Math.abs(m.position.x - target.x) > 0.04 || Math.abs(m.position.z - target.z) > 0.04;
    // Lift up, slide across, then drop: the block never passes through a peg.
    const wantY = farX ? liftY : target.y;
    m.position.y += (wantY - m.position.y) * k;
    if (Math.abs(m.position.y - liftY) < 0.12 || !farX) {
      m.position.x += (target.x - m.position.x) * k;
      m.position.z += (target.z - m.position.z) * k;
    }
    m.rotation.y = lifted ? Math.sin(performance.now() / 300) * 0.12 : m.rotation.y * (1 - k);
  });
  return <mesh ref={ref} geometry={geo} material={voxelMaterial} castShadow receiveShadow onClick={onClick} />;
}

interface BoardProps {
  caps: number[];
  pegs: Pegs;
  held?: { peg: number } | null;
  interactive?: boolean;
  /** Practice hint: peg to take from and peg to put on. */
  hint?: [number, number] | null;
  onPeg?: (i: number) => void;
}

function Board({ caps, pegs, held, interactive, hint, onPeg }: BoardProps) {
  const [hover, setHover] = useState<number | null>(null);
  const n = caps.length;
  const tall = Math.max(...caps);
  const liftY = BASE_H + pegHeight(tall) + BS * 0.8;
  const base = useMemo(() => {
    const w = GAP * n + 0.3;
    const parts: Part[] = [box([w, BASE_H, 1.6], [0, BASE_H / 2, 0], '#a16207'), box([w - 0.12, 0.04, 1.48], [0, BASE_H + 0.01, 0], '#c08a4a')];
    caps.forEach((c, i) => parts.push(box([0.16, pegHeight(c), 0.16], [pegX(i, n), BASE_H + pegHeight(c) / 2, 0], '#6b4423')));
    return mergeParts(parts)!;
  }, [caps]);

  // Where each block should be.
  const targets = useMemo(() => {
    const t: { id: number; pos: THREE.Vector3; lifted: boolean; peg: number }[] = [];
    pegs.forEach((stack, i) =>
      stack.forEach((id, k) => {
        const lifted = !!held && held.peg === i && k === stack.length - 1;
        t.push({ id, peg: i, lifted, pos: new THREE.Vector3(pegX(i, n), lifted ? liftY : levelY(k), 0) });
      }),
    );
    return t.sort((a, b) => a.id - b.id);
  }, [pegs, held]);

  const click = (i: number) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 6 || !interactive) return;
    onPeg?.(i);
  };

  return (
    <group>
      <mesh geometry={base} material={voxelMaterial} castShadow receiveShadow />
      {caps.map((c, i) => {
        const tone = hint?.[0] === i ? '#facc15' : hint?.[1] === i ? '#22c55e' : interactive && hover === i ? '#ffffff' : null;
        return (
          <group key={i}>
            {/* Capacity marks: one notch per slot on the peg's front. */}
            {Array.from({ length: c }, (_, k) => (
              <mesh key={k} position={[pegX(i, n), levelY(k), 0.6]}>
                <boxGeometry args={[0.5, 0.03, 0.02]} />
                <meshBasicMaterial color="#7c4a1e" transparent opacity={0.5} />
              </mesh>
            ))}
            {tone && (
              <mesh position={[pegX(i, n), BASE_H + 0.035, 0]}>
                <boxGeometry args={[GAP * 0.86, 0.03, 1.3]} />
                <meshBasicMaterial color={tone} transparent opacity={tone === '#ffffff' ? 0.35 : 0.75} />
              </mesh>
            )}
            {interactive && (
              <mesh
                position={[pegX(i, n), BASE_H + (pegHeight(tall) + BS) / 2, 0]}
                onClick={click(i)}
                onPointerOver={(e) => {
                  e.stopPropagation();
                  setHover(i);
                  document.body.style.cursor = 'pointer';
                }}
                onPointerOut={() => {
                  setHover((h) => (h === i ? null : h));
                  document.body.style.cursor = '';
                }}
              >
                <boxGeometry args={[GAP * 0.92, pegHeight(tall) + BS * 1.6, 1.6]} />
                <meshBasicMaterial transparent opacity={0} depthWrite={false} />
              </mesh>
            )}
          </group>
        );
      })}
      {targets.map((t) => (
        <Block key={t.id} id={t.id} target={t.pos} lifted={t.lifted} liftY={liftY} onClick={interactive ? click(t.peg) : undefined} />
      ))}
    </group>
  );
}

export interface TowerSceneProps {
  caps: number[];
  pegs: Pegs;
  goal: Pegs;
  held: { peg: number } | null;
  interactive: boolean;
  hint: [number, number] | null;
  solved: boolean;
  onPeg: (i: number) => void;
}

function Confetti({ on }: { on: boolean }) {
  const g = useRef<THREE.Group>(null);
  const t0 = useRef(0);
  const bits = useMemo(() => Array.from({ length: 28 }, (_, k) => ({ x: Math.cos(k * 2.4) * (0.5 + (k % 5) * 0.3), z: Math.sin(k * 2.4) * 0.6, v: 3 + (k % 4), c: BLOCKS[k % 4].main })), []);
  useFrame(({ clock }) => {
    if (!g.current) return;
    if (!on) {
      t0.current = clock.elapsedTime;
      g.current.visible = false;
      return;
    }
    const t = clock.elapsedTime - t0.current;
    g.current.visible = t < 1.6;
    g.current.children.forEach((c, k) => {
      const b = bits[k];
      c.position.set(b.x * (1 + t), 2.6 + b.v * t - 4.9 * t * t, b.z * (1 + t));
      c.rotation.set(t * 7, t * 5 + k, 0);
    });
  });
  return (
    <group ref={g} position={[-1.6, 0, 0]}>
      {bits.map((b, k) => (
        <mesh key={k}>
          <boxGeometry args={[0.12, 0.12, 0.04]} />
          <meshBasicMaterial color={b.c} />
        </mesh>
      ))}
    </group>
  );
}

function Scene({ caps, pegs, goal, held, interactive, hint, solved, onPeg }: TowerSceneProps) {
  const ground = useMemo(() => {
    const parts: Part[] = [];
    for (let x = -9; x < 9; x++) for (let z = -6; z < 6; z++) parts.push(box([1, 0.2, 1], [x + 0.5, -0.1, z + 0.5], (x + z) % 2 ? '#e7d8bf' : '#ddcba9'));
    return mergeParts(parts)!;
  }, []);
  const goalScale = 0.62;
  return (
    <>
      <color attach="background" args={['#dbeafe']} />
      <fog attach="fog" args={['#dbeafe', 16, 30]} />
      <Lights size={9} centre={[0, 0, 0]} sun={[4, 10, 6]} />
      <mesh geometry={ground} material={voxelMaterial} receiveShadow />
      <group position={[-1.6, 0, 0]}>
        <Board caps={caps} pegs={pegs} held={held} interactive={interactive} hint={hint} onPeg={onPeg} />
        <Label3D position={[0, -0.05, 1.25]} text="Your board" className="label3d" />
      </group>
      <group position={[4.1, 0, -0.6]} scale={goalScale}>
        <Board caps={caps} pegs={goal} />
        <Label3D position={[0, pegHeight(Math.max(...caps)) + 1.2, 0]} text="Goal" className="label3d big" />
      </group>
      <Confetti on={solved} />
      <OrbitControls
        makeDefault
        target={[0.9, 1.3, 0]}
        enablePan={false}
        enableDamping
        minDistance={9}
        maxDistance={17}
        minAzimuthAngle={-0.6}
        maxAzimuthAngle={0.6}
        minPolarAngle={0.6}
        maxPolarAngle={1.35}
      />
    </>
  );
}

export default function TowerScene(props: TowerSceneProps) {
  return (
    <Stage3D className="tower-canvas" camera={{ position: [0.9, 6.4, 12.6], fov: 31 }} onPointerMissed={() => (document.body.style.cursor = '')}>
      <Scene {...props} />
    </Stage3D>
  );
}
