import { useRef } from 'react';
import { Mesh, GridHelper } from 'three';

interface FloorPlaneProps {
  width: number;
  depth: number;
}

export function FloorPlane({ width, depth }: FloorPlaneProps) {
  const meshRef = useRef<Mesh>(null);

  return (
    <group>
      <mesh ref={meshRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      
      <gridHelper
        args={[Math.max(width, depth), Math.max(width, depth) / 2, '#333355', '#222244']}
        position={[0, 0.01, 0]}
      />
    </group>
  );
}
