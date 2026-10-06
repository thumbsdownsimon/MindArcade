import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import VoxelModel, { type Rig } from './VoxelModel';
import type { Model } from './voxel';

function Turntable({ id, model, flap }: { id: string; model: Model; flap?: boolean }) {
  const g = useRef<THREE.Group>(null);
  const rig = useRef<Rig>(null);
  useFrame(({ clock }, dt) => {
    if (!g.current) return;
    g.current.rotation.y += dt * 0.8;
    const t = clock.elapsedTime;
    g.current.position.y = Math.abs(Math.sin(t * 2.2)) * 0.05;
    if (flap && rig.current?.wingL) {
      const a = Math.max(0, Math.sin(t * 3)) * 0.6;
      rig.current.wingL.rotation.z = -a;
      rig.current.wingR.rotation.z = a;
    }
  });
  return (
    <group ref={g}>
      <VoxelModel ref={rig} id={id} model={model} shadows={false} />
    </group>
  );
}

/** Small spinning 3D preview of a model, e.g. "your bird". Uses its own lightweight canvas. */
export default function ModelPreview({ id, model, height = 0.9, distance = 2.2, flap }: { id: string; model: Model; height?: number; distance?: number; flap?: boolean }) {
  return (
    <Canvas className="preview3d" dpr={[1, 2]} camera={{ position: [0, height + 0.5, distance], fov: 30 }} onCreated={({ camera }) => camera.lookAt(0, height * 0.45, 0)}>
      <hemisphereLight args={['#ffffff', '#88a070', 2]} />
      <directionalLight position={[2, 4, 3]} intensity={2} />
      <Turntable id={id} model={model} flap={flap} />
    </Canvas>
  );
}
