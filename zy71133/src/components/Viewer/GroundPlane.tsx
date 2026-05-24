import { useMemo } from 'react';
import * as THREE from 'three';

interface GroundPlaneProps {
  size?: number;
  height?: number;
  showGrid?: boolean;
}

export function GroundPlane({ size = 100, height = 0, showGrid = true }: GroundPlaneProps) {
  const gridHelper = useMemo(() => {
    return new THREE.GridHelper(size, 50, '#444444', '#333333');
  }, [size]);

  return (
    <group position={[0, height, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial
          color="#1E293B"
          transparent
          opacity={0.8}
          side={2}
        />
      </mesh>
      {showGrid && <primitive object={gridHelper} />}
    </group>
  );
}
