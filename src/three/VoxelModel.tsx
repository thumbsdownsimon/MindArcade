import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react';
import type * as THREE from 'three';
import { boneGeometries, voxelMaterial, type Model } from './voxel';

export type Rig = Record<string, THREE.Group>;

interface Props {
  /** Cache key: models with the same key share geometry. */
  id: string;
  model: Model;
  shadows?: boolean;
  material?: THREE.Material;
  children?: ReactNode;
}

/** Renders a blocky model as one group per bone. The ref exposes the bones for animation. */
const VoxelModel = forwardRef<Rig, Props>(function VoxelModel({ id, model, shadows = true, material = voxelMaterial, children }, ref) {
  const geos = boneGeometries(id, model);
  const bones = useRef<Rig>({});
  useImperativeHandle(ref, () => bones.current, []);
  return (
    <group>
      {Object.entries(model).map(([name, b]) => (
        <group key={name} position={b.pivot} ref={(g) => { if (g) bones.current[name] = g; }}>
          {geos[name] && <mesh geometry={geos[name]!} material={material} castShadow={shadows} receiveShadow={shadows} />}
        </group>
      ))}
      {children}
    </group>
  );
});

export default VoxelModel;
