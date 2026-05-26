import { useRef } from 'react';
import { OrbitControls } from '@react-three/drei';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyType = any;

export function CameraControls() {
  const controlsRef = useRef<AnyType>(null);

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.05}
      minDistance={30}
      maxDistance={100}
      minPolarAngle={Math.PI / 6}
      maxPolarAngle={Math.PI / 2.5}
      enablePan={true}
      panSpeed={0.5}
      rotateSpeed={0.5}
      zoomSpeed={0.8}
    />
  );
}
