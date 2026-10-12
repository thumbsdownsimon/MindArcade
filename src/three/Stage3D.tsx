import { useLayoutEffect } from 'react';
import { Canvas, useThree, type CanvasProps } from '@react-three/fiber';
import * as THREE from 'three';
import './stage3d.css';

/**
 * Phones and tablets: touch screen or a small window. They get a lower pixel ratio and smaller
 * shadow maps, which roughly halves the GPU work with little visible difference on a small screen.
 */
export const LOW_POWER =
  typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600);

/**
 * A perspective camera's field of view is vertical, so a narrow (portrait) canvas crops the sides of the scene.
 * When the canvas is narrower than `aspect`, zoom the camera out just enough to keep the same width in view.
 */
function FitWidth({ aspect }: { aspect: number }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !size.height) return;
    const zoom = Math.min(1, size.width / size.height / aspect);
    if (Math.abs(camera.zoom - zoom) > 0.001) {
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height, aspect]);
  return null;
}

interface Props extends CanvasProps {
  /** Narrowest width ÷ height at which the whole scene still fits; narrower canvases zoom out. */
  fitAspect?: number;
}

/** Canvas with the shared look: soft shadows, sRGB output, capped pixel ratio, and a no-WebGL fallback. */
export default function Stage3D({ children, className = '', fitAspect, ...rest }: Props) {
  return (
    <div className={`stage3d ${className}`}>
      <Canvas
        shadows={{ type: LOW_POWER ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap }}
        dpr={LOW_POWER ? [1, 1.5] : [1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        fallback={
          <div className="stage3d-fallback">
            This game needs WebGL (3D graphics). Try a recent version of Chrome, Edge, Firefox or Safari, and check that
            hardware acceleration is turned on.
          </div>
        }
        {...rest}
      >
        {fitAspect && <FitWidth aspect={fitAspect} />}
        {children}
      </Canvas>
    </div>
  );
}

/** Sky light plus a sun that casts shadows over an area of `size` units around `centre`. */
export function Lights({ size = 14, centre = [0, 0, 0] as [number, number, number], sun = [6, 12, 6] as [number, number, number], intensity = 2.4 }) {
  const map = LOW_POWER ? 1024 : 2048;
  return (
    <>
      <hemisphereLight args={['#dbeafe', '#6b8f4e', 1.25]} />
      <directionalLight
        position={[centre[0] + sun[0], sun[1], centre[2] + sun[2]]}
        intensity={intensity}
        castShadow
        shadow-mapSize={[map, map]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-left={-size}
        shadow-camera-right={size}
        shadow-camera-top={size}
        shadow-camera-bottom={-size}
        shadow-camera-near={0.5}
        shadow-camera-far={80}
      >
        <object3D attach="target" position={centre} />
      </directionalLight>
    </>
  );
}
