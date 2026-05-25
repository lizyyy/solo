import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { ThreeEvent } from '@react-three/fiber';

interface GroundPlaneProps {
  size?: number;
  height?: number;
  showGrid?: boolean;
  onGroundClick?: (point: { x: number; z: number }) => void;
}

export function GroundPlane({ size = 100, height = 0, showGrid = true, onGroundClick }: GroundPlaneProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  const gridHelper = useMemo(() => {
    return new THREE.GridHelper(size, 50, '#444444', '#333333');
  }, [size]);

  const handlePointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (onGroundClick && event.point) {
      onGroundClick({ x: event.point.x, z: event.point.z });
    }
  };

  return (
    <group position={[0, height, 0]}>
      <mesh
        ref={meshRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
        onPointerDown={handlePointerDown}
      >
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
