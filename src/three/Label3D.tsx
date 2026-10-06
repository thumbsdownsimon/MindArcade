import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface Props {
  position?: [number, number, number];
  text: string;
  /** Optional lighter second part, e.g. a hint. */
  sub?: string;
  className?: string;
}

const v = new THREE.Vector3();

/**
 * A text label pinned to a point in the scene. Plain DOM positioned every frame,
 * which is lighter than a nested React root and follows its parent's transform.
 */
export default function Label3D({ position = [0, 0, 0], text, sub, className = 'label3d' }: Props) {
  const anchor = useRef<THREE.Group>(null);
  const gl = useThree((s) => s.gl);
  const el = useMemo(() => {
    const d = document.createElement('div');
    d.className = 'label3d-anchor';
    return d;
  }, []);

  useLayoutEffect(() => {
    gl.domElement.parentElement?.appendChild(el);
    return () => el.remove();
  }, [gl, el]);

  useLayoutEffect(() => {
    el.replaceChildren();
    const inner = document.createElement('div');
    inner.className = className;
    inner.textContent = text;
    if (sub) {
      const s = document.createElement('span');
      s.className = 'label3d-hint';
      s.textContent = ` · ${sub}`;
      inner.appendChild(s);
    }
    el.appendChild(inner);
  }, [el, text, sub, className]);

  useFrame(({ camera, size }) => {
    if (!anchor.current) return;
    anchor.current.getWorldPosition(v).project(camera);
    const hidden = v.z > 1 || v.z < -1;
    el.style.display = hidden ? 'none' : '';
    el.style.transform = `translate(${((v.x + 1) / 2) * size.width}px, ${((1 - v.y) / 2) * size.height}px) translate(-50%, -100%)`;
  });

  return <group ref={anchor} position={position} />;
}
