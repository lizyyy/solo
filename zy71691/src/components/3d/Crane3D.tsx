import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Crane } from '@/types';
import { useYardStore } from '@/store/useYardStore';

interface Crane3DProps {
  crane: Crane;
  isInConflict: boolean;
}

export function Crane3D({ crane, isInConflict }: Crane3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const trolleyRef = useRef<THREE.Mesh>(null);
  const { selectedObjectId, setSelectedObject } = useYardStore();
  const isSelected = selectedObjectId === crane.id;

  useFrame((state) => {
    if (trolleyRef.current && crane.status === 'working') {
      const trolleyX = Math.sin(state.clock.elapsedTime * 0.5) * 3;
      trolleyRef.current.position.x = trolleyX;
    }

    if (groupRef.current && (isInConflict || isSelected)) {
      groupRef.current.position.y = crane.position.y + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  const getColor = () => {
    if (isInConflict) return '#FF6B35';
    if (isSelected) return '#FFD700';
    return crane.status === 'working' ? '#2ECC71' : crane.status === 'maintenance' ? '#E74C3C' : '#95A5A6';
  };

  return (
    <group
      ref={groupRef}
      position={[crane.position.x, crane.position.y, crane.position.z]}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedObject(crane.id, 'crane');
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      <mesh position={[-5, 2, 0]} castShadow>
        <boxGeometry args={[0.5, 4, 0.5]} />
        <meshStandardMaterial color="#34495E" />
      </mesh>
      <mesh position={[5, 2, 0]} castShadow>
        <boxGeometry args={[0.5, 4, 0.5]} />
        <meshStandardMaterial color="#34495E" />
      </mesh>

      <mesh position={[0, 4, 0]} castShadow>
        <boxGeometry args={[12, 0.6, 0.6]} />
        <meshStandardMaterial color={getColor()} metalness={0.5} roughness={0.5} />
      </mesh>

      <mesh ref={trolleyRef} position={[0, 4.2, 0]} castShadow>
        <boxGeometry args={[1.5, 0.8, 1.5]} />
        <meshStandardMaterial color="#F39C12" />
      </mesh>

      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
        <meshStandardMaterial color="#7F8C8D" />
      </mesh>

      <mesh position={[0, 2, 0]} castShadow>
        <boxGeometry args={[1, 0.5, 1]} />
        <meshStandardMaterial color="#2C3E50" />
      </mesh>

      {(isInConflict || isSelected) && (
        <mesh position={[0, 5.5, 0]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color={isInConflict ? '#FF0000' : '#FFD700'} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}
