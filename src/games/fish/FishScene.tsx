import { useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import Stage3D, { Lights } from '../../three/Stage3D';
import VoxelModel, { type Rig } from '../../three/VoxelModel';
import Label3D from '../../three/Label3D';
import { box, mergeParts, type Part } from '../../three/voxel';
import { mix } from '../../three/models';
import { GROUP_OFFSETS, fishId, fishModel, type Group } from './fishLook';

const POND_W = 12.5;
const POND_D = 9.4;
const WATER_Y = -0.12;

/** Lily pad position from the game's percentage layout. North (top of the old 2D pond) is −z. */
export const spotPos = (s: { x: number; y: number }): [number, number] => [(s.x / 100 - 0.5) * POND_W, (s.y / 100 - 0.5) * POND_D];

export interface PadView {
  /** 'answer' glows green, 'wrong' red. */
  mark?: 'answer' | 'wrong';
  label?: string;
  tone?: 'accent' | 'ok' | 'bad';
}

export interface FishSceneProps {
  spots: { x: number; y: number }[];
  areas: string[];
  pads: PadView[];
  spotClickable: boolean;
  areaClickable: boolean;
  pickedArea: number | null;
  visible: { group: Group; key: string } | null;
  banner: string | null;
  onSpot: (i: number) => void;
  onArea: (a: number) => void;
}

/* ---------- Static scenery ---------- */

function useGround() {
  return useMemo(() => {
    const parts: Part[] = [];
    const T = 0.8;
    for (let x = -16; x < 16; x += T)
      for (let z = -12; z < 12; z += T) {
        const cx = x + T / 2, cz = z + T / 2;
        const d = (cx / (POND_W / 2 + 0.9)) ** 2 + (cz / (POND_D / 2 + 0.9)) ** 2 + Math.sin(cx * 1.7 + cz) * 0.03;
        const check = (Math.round(x / T) + Math.round(z / T)) % 2 === 0;
        if (d < 1) parts.push(box([T, 0.3, T], [cx, -1.1, cz], '#3d7f8f'));
        else if (d < 1.32) parts.push(box([T, 0.5 + (check ? 0.05 : 0), T], [cx, -0.15, cz], check ? '#a8a29e' : '#b6b0aa'));
        else parts.push(box([T, 0.6, T], [cx, -0.2 + (d > 2.2 ? 0.15 : 0), cz], check ? '#7cbd57' : '#75b551'));
      }
    // Reeds, flowers and a few trees along the back.
    const rnd = (k: number) => (Math.sin(k * 12.9898) * 43758.5453) % 1;
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      const rx = Math.cos(a) * (POND_W / 2 + 1.6 + Math.abs(rnd(k)) * 1.6);
      const rz = Math.sin(a) * (POND_D / 2 + 1.6 + Math.abs(rnd(k + 9)) * 1.4);
      if (rz > POND_D / 2 && Math.abs(rx) < 5) continue; // keep the camera side clear
      if (k % 3 === 0) parts.push(box([0.12, 0.9, 0.12], [rx, 0.45, rz], '#4d7c2f'), box([0.16, 0.3, 0.16], [rx, 0.95, rz], '#7c4a1e'));
      else parts.push(box([0.06, 0.3, 0.06], [rx, 0.25, rz], '#3f8f2f'), box([0.2, 0.18, 0.2], [rx, 0.45, rz], ['#f43f5e', '#facc15', '#f8fafc', '#a855f7'][k % 4]));
    }
    for (const [x, z, h] of [[-11, -8, 2.2], [-6.5, -10, 2.6], [0, -11, 2.4], [6, -10, 2.2], [11, -8, 2.6], [-13, -2, 2.2], [13, -1, 2.3]] as const) {
      const leaf = h > 2.4 ? '#2f7d32' : '#3f9b3a';
      parts.push(box([0.5, h, 0.5], [x, h / 2, z], '#6b4423'), box([2.6, 1.6, 2.6], [x, h + 0.7, z], leaf), box([1.6, 0.8, 1.6], [x, h + 1.9, z], mix(leaf, '#ffffff', 0.08)));
    }
    return mergeParts(parts)!;
  }, []);
}

function Water() {
  const ripples = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    ripples.current?.children.forEach((c, k) => {
      const t = (clock.elapsedTime * 0.35 + k * 0.37) % 1;
      c.scale.setScalar(0.4 + t * 2.2);
      ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.35 * (1 - t);
    });
  });
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position={[0, WATER_Y, 0]} receiveShadow>
        <circleGeometry args={[1, 48]} />
        <meshStandardMaterial color="#1fa3c4" transparent opacity={0.88} roughness={0.15} metalness={0.15} />
      </mesh>
      {/* the circle is stretched into the pond's ellipse */}
      <group ref={ripples}>
        {[[-4, -2], [3, 2.5], [4.5, -2.5]].map(([x, z], k) => (
          <mesh key={k} rotation-x={-Math.PI / 2} position={[x, WATER_Y + 0.01, z]}>
            <ringGeometry args={[0.45, 0.5, 24]} />
            <meshBasicMaterial color="#e0f7ff" transparent opacity={0.3} />
          </mesh>
        ))}
      </group>
    </>
  );
}

/* ---------- Interactive bits ---------- */

const MARK_COLOR = { answer: '#4ade80', wrong: '#f87171' };

function LilyPad({ i, pos, view, clickable, onSpot }: { i: number; pos: [number, number]; view: PadView; clickable: boolean; onSpot: (i: number) => void }) {
  const [hover, setHover] = useState(false);
  const g = useRef<THREE.Group>(null);
  useFrame(({ clock }, dt) => {
    if (!g.current) return;
    const t = clock.elapsedTime;
    g.current.position.y = WATER_Y + 0.02 + Math.sin(t * 1.3 + i) * 0.015;
    g.current.rotation.y = Math.sin(t * 0.3 + i * 2) * 0.15 + i;
    const s = clickable && hover ? 1.12 : 1;
    g.current.scale.x += (s - g.current.scale.x) * (1 - Math.exp(-14 * dt));
    g.current.scale.z = g.current.scale.x;
  });
  const leaf = clickable && hover ? '#6fd35f' : '#4d9f45';
  return (
    <group position={[pos[0], 0, pos[1]]}>
      <group
        ref={g}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          if (clickable && e.delta < 6) onSpot(i);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          if (clickable) document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = '';
        }}
      >
        {view.mark && (
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[1.22, 1.22, 0.06, 8]} />
            <meshBasicMaterial color={MARK_COLOR[view.mark]} />
          </mesh>
        )}
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.9, 0.9, 0.08, 8, 1, false, 0.35, Math.PI * 2 - 0.35]} />
          <meshStandardMaterial color={leaf} roughness={0.8} emissive={clickable && hover ? '#2f6b1f' : '#000000'} />
        </mesh>
        <mesh position={[0.28, 0.06, 0.18]}>
          <boxGeometry args={[0.36, 0.04, 0.05]} />
          <meshStandardMaterial color="#3f8a39" />
        </mesh>
        {i % 3 === 0 && (
          <mesh position={[-0.35, 0.12, -0.3]} castShadow>
            <boxGeometry args={[0.22, 0.18, 0.22]} />
            <meshStandardMaterial color="#f9a8d4" />
          </mesh>
        )}
      </group>
      {view.label && <Label3D position={[0, 0.8, 0]} text={view.label} className={`tap3d ${view.tone ?? 'accent'}`} />}
    </group>
  );
}

function Areas({ areas, clickable, picked, onArea }: { areas: string[]; clickable: boolean; picked: number | null; onArea: (a: number) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = POND_W / 2, d = POND_D / 2;
  return (
    <>
      {areas.map((name, a) => {
        const cx = (a % 2 ? 1 : -1) * (w / 2);
        const cz = (a < 2 ? -1 : 1) * (d / 2);
        const on = picked === a || (clickable && hover === a);
        return (
          <group key={name}>
            <mesh
              rotation-x={-Math.PI / 2}
              position={[cx, WATER_Y + 0.02, cz]}
              onClick={(e) => {
                if (!clickable || e.delta > 6) return;
                e.stopPropagation();
                onArea(a);
              }}
              onPointerOver={() => {
                setHover(a);
                if (clickable) document.body.style.cursor = 'pointer';
              }}
              onPointerOut={() => {
                setHover((h) => (h === a ? null : h));
                document.body.style.cursor = '';
              }}
            >
              <planeGeometry args={[w - 0.1, d - 0.1]} />
              <meshBasicMaterial color="#ffffff" transparent opacity={on ? 0.28 : clickable ? 0.07 : 0} depthWrite={false} />
            </mesh>
            <Label3D
              position={[(a % 2 ? 1 : -1) * 1.8, 0.1, (a < 2 ? -1 : 1) * 0.55 + (a < 2 ? 0 : 0.45)]}
              text={name}
              className={`area3d ${clickable ? 'is-live' : ''}`}
            />
          </group>
        );
      })}
      {/* dashed cross dividing the four areas */}
      {Array.from({ length: 13 }, (_, k) => (
        <mesh key={`h${k}`} position={[-POND_W / 2 + 0.5 + k * ((POND_W - 1) / 12), WATER_Y + 0.02, 0]}>
          <boxGeometry args={[0.45, 0.01, 0.06]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.45} />
        </mesh>
      ))}
      {Array.from({ length: 10 }, (_, k) => (
        <mesh key={`v${k}`} position={[0, WATER_Y + 0.02, -POND_D / 2 + 0.5 + k * ((POND_D - 1) / 9)]}>
          <boxGeometry args={[0.06, 0.01, 0.45]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.45} />
        </mesh>
      ))}
    </>
  );
}

/** A fish group leaping out of the water above its lily pad. */
function Leap({ group, at }: { group: Group; at: [number, number] }) {
  const g = useRef<THREE.Group>(null);
  const rigs = useRef<(Rig | null)[]>([]);
  const t0 = useRef<number | null>(null);
  const splash = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!g.current) return;
    if (t0.current === null) t0.current = clock.elapsedTime;
    const t = clock.elapsedTime - t0.current;
    const p = Math.min(1, t / 0.35);
    // Leap up in an arc, then hover with a gentle bob.
    g.current.position.y = p < 1 ? -0.6 + Math.sin(p * Math.PI * 0.5) * 1.4 : 0.8 + Math.sin(t * 3) * 0.06;
    g.current.rotation.z = p < 1 ? (1 - p) * 0.6 : Math.sin(t * 2) * 0.05;
    rigs.current.forEach((r, k) => {
      if (r?.tail) r.tail.rotation.y = Math.sin(t * 12 + k) * 0.5;
    });
    if (splash.current) {
      const s = Math.min(1, t / 0.6);
      splash.current.visible = s < 1;
      splash.current.children.forEach((c, k) => {
        const a = (k / splash.current!.children.length) * Math.PI * 2;
        c.position.set(Math.cos(a) * (0.3 + s * 1.1), WATER_Y + Math.sin(s * Math.PI) * 0.5, Math.sin(a) * (0.3 + s * 1.1));
      });
    }
  });
  return (
    <group position={[at[0], 0, at[1]]}>
      <group ref={g}>
        {GROUP_OFFSETS[group.count].map((o, k) => (
          <group key={k} position={o}>
            <VoxelModel ref={(r) => { rigs.current[k] = r; }} id={fishId(group.color, group.pattern)} model={fishModel(group.color, group.pattern)} />
          </group>
        ))}
      </group>
      <group ref={splash}>
        {Array.from({ length: 10 }, (_, k) => (
          <mesh key={k}>
            <boxGeometry args={[0.1, 0.1, 0.1]} />
            <meshBasicMaterial color="#e0f7ff" />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/* ---------- Scene ---------- */

export default function FishScene({ spots, areas, pads, spotClickable, areaClickable, pickedArea, visible, banner, onSpot, onArea }: FishSceneProps) {
  const ground = useGround();
  const positions = useMemo(() => spots.map(spotPos), [spots]);
  return (
    <Stage3D className="fish-canvas" camera={{ position: [0, 12.2, 10.8], fov: 42 }} onCreated={({ camera }) => camera.lookAt(0, -0.9, 0.3)}>
      <color attach="background" args={['#bfe3fb']} />
      <fog attach="fog" args={['#bfe3fb', 20, 40]} />
      <Lights size={12} sun={[5, 12, 6]} />
      <mesh geometry={ground} receiveShadow castShadow>
        <meshStandardMaterial vertexColors roughness={1} />
      </mesh>
      <group scale={[POND_W / 2 + 1.1, 1, POND_D / 2 + 1.1]}>
        <Water />
      </group>
      <Areas areas={areas} clickable={areaClickable} picked={pickedArea} onArea={onArea} />
      {positions.map((p, i) => (
        <LilyPad key={i} i={i} pos={p} view={pads[i]} clickable={spotClickable} onSpot={onSpot} />
      ))}
      {visible && <Leap key={visible.key} group={visible.group} at={positions[visible.group.spot]} />}
      {banner && <Label3D position={[0, 1.6, 0]} text={banner} className="label3d big" />}
    </Stage3D>
  );
}
