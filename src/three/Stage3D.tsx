import { Canvas, type CanvasProps } from '@react-three/fiber';
import * as THREE from 'three';
import './stage3d.css';

/** Canvas with the shared look: soft shadows, sRGB output, capped pixel ratio, and a no-WebGL fallback. */
export default function Stage3D({ children, className = '', ...rest }: CanvasProps) {
  return (
    <div className={`stage3d ${className}`}>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        fallback={
          <div className="stage3d-fallback">
            This game needs WebGL (3D graphics). Try a recent version of Chrome, Edge, Firefox or Safari, and check that
            hardware acceleration is turned on.
          </div>
        }
        {...rest}
      >
        {children}
      </Canvas>
    </div>
  );
}

/** Sky light plus a sun that casts shadows over an area of `size` units around `centre`. */
export function Lights({ size = 14, centre = [0, 0, 0] as [number, number, number], sun = [6, 12, 6] as [number, number, number], intensity = 2.4 }) {
  return (
    <>
      <hemisphereLight args={['#dbeafe', '#6b8f4e', 1.25]} />
      <directionalLight
        position={[centre[0] + sun[0], sun[1], centre[2] + sun[2]]}
        intensity={intensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
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
