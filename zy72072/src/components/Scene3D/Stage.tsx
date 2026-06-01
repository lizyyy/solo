import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StageProps {
  width?: number;
  depth?: number;
}

export const Stage = ({ width = 20, depth = 24 }: StageProps) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
    }
  });

  return (
    <group ref={groupRef}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#1a1a2e" transparent opacity={0.8} />
      </mesh>

      <gridHelper
        args={[width, 20, '#3b82f6', '#1e3a5f']}
        position={[0, 0.01, 0]}
      />

      <mesh position={[0, 0.1, -depth / 2 + 1]}>
        <boxGeometry args={[width - 2, 0.2, 2]} />
        <meshStandardMaterial color="#2d3748" />
      </mesh>

      <mesh position={[-width / 2 + 0.25, 3, 0]}>
        <boxGeometry args={[0.5, 6, depth]} />
        <meshStandardMaterial color="#1a202c" transparent opacity={0.6} />
      </mesh>

      <mesh position={[width / 2 - 0.25, 3, 0]}>
        <boxGeometry args={[0.5, 6, depth]} />
        <meshStandardMaterial color="#1a202c" transparent opacity={0.6} />
      </mesh>

      <mesh position={[0, 6, -depth / 2 + 0.25]}>
        <boxGeometry args={[width, 0.5, 0.5]} />
        <meshStandardMaterial color="#1a202c" transparent opacity={0.6} />
      </mesh>

      <group position={[0, 0, -depth / 4]}>
        {[...Array(5)].map((_, i) => (
          <mesh key={i} position={[-8 + i * 4, 8, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 16, 8]} />
            <meshStandardMaterial color="#4a5568" />
          </mesh>
        ))}
      </group>
    </group>
  );
};
