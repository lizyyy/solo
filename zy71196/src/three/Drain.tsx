import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import type { Drain as DrainType } from '../game/types';

interface DrainProps {
  drain: DrainType;
  onClick: () => void;
  isSelected: boolean;
}

export function Drain({ drain, onClick, isSelected }: DrainProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state, delta) => {
    if (meshRef.current && drain.isBlocked) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  const getColor = () => {
    if (isSelected) return '#FFD700';
    if (hovered) return '#87CEEB';
    if (!drain.inspected) return '#666666';
    if (drain.isBlocked) return '#FF4444';
    if (drain.resolved) return '#44FF44';
    return '#888888';
  };

  return (
    <group position={[drain.position.x, 0.05, drain.position.y]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
      >
        <cylinderGeometry args={[0.3, 0.4, 0.1, 16]} />
        <meshStandardMaterial
          color={getColor()}
          metalness={0.8}
          roughness={0.2}
          emissive={isSelected ? '#FFD700' : '#000000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
        />
      </mesh>
      
      <mesh position={[0, 0.06, 0]}>
        <torusGeometry args={[0.35, 0.03, 8, 16]} />
        <meshStandardMaterial
          color="#333333"
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {drain.isBlocked && (
        <mesh position={[0, 0.15, 0]}>
          <coneGeometry args={[0.15, 0.2, 4]} />
          <meshStandardMaterial
            color="#8B4513"
            roughness={0.8}
          />
        </mesh>
      )}

      {hovered && (
        <mesh position={[0, 0.5, 0]}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="#FFFFFF" />
        </mesh>
      )}
    </group>
  );
}
