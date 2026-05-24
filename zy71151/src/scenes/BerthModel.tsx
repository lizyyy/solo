import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Berth } from '../types';

interface BerthModelProps {
  berth: Berth;
  onClick?: () => void;
}

export function BerthModel({ berth, onClick }: BerthModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const length = berth.length / 8;
  const width = 2;

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(berth.position.x / 10, 0, berth.position.z / 10);
      groupRef.current.rotation.y = berth.rotation;
    }
  });

  const dockColor = berth.occupied ? '#6b7280' : '#4b5563';

  return (
    <group ref={groupRef} onClick={onClick}>
      <mesh position={[0, -0.3, 0]} receiveShadow>
        <boxGeometry args={[width, 0.6, length]} />
        <meshStandardMaterial color={dockColor} metalness={0.2} roughness={0.8} />
      </mesh>

      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[width * 1.1, 0.05, length * 1.05]} />
        <meshStandardMaterial color="#374151" />
      </mesh>

      {Array.from({ length: Math.floor(length / 2) }).map((_, i) => (
        <mesh
          key={i}
          position={[width / 2 + 0.1, 0.1, -length / 2 + 1 + i * 2]}
        >
          <cylinderGeometry args={[0.1, 0.12, 0.3, 8]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
      ))}

      <mesh position={[-width / 2 - 0.5, 1, 0]}>
        <boxGeometry args={[0.3, 2, 0.3]} />
        <meshStandardMaterial color="#1f2937" />
      </mesh>

      <mesh position={[-width / 2 - 0.5, 2.2, 0]}>
        <sphereGeometry args={[0.25, 16, 16]} />
        <meshBasicMaterial color={berth.occupied ? '#ef4444' : '#22c55e'} />
      </mesh>

      {!berth.occupied && (
        <mesh position={[0, 2.5, 0]} rotation={[0, -Math.PI / 4, 0]}>
          <planeGeometry args={[1.5, 0.8]} />
          <meshBasicMaterial color="#3b82f6" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
