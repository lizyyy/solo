import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import * as THREE from 'three';
import type { EnergyLevel as EnergyLevelType } from '@/types';

interface EnergyLevelProps {
  level: EnergyLevelType;
  isSelected: boolean;
  onClick: () => void;
}

export function EnergyLevel({ level, isSelected, onClick }: EnergyLevelProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.position.y = level.height + Math.sin(elapsed * 0.5 + level.n) * 0.05;
    }
    if (ringRef.current) {
      ringRef.current.rotation.y = elapsed * 0.3;
    }
  });

  const scale = isSelected ? 1.15 : hovered ? 1.05 : 1;
  const emissiveIntensity = isSelected ? 2 : hovered ? 1 : 0.5;

  return (
    <group position={[0, level.height, 0]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={scale}
      >
        <cylinderGeometry args={[1.2, 1.5, 0.15, 32]} />
        <meshStandardMaterial
          color={level.color}
          emissive={level.color}
          emissiveIntensity={emissiveIntensity}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      <mesh ref={ringRef} position={[0, 0.1, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.8, 0.02, 8, 64]} />
        <meshStandardMaterial
          color={level.color}
          emissive={level.color}
          emissiveIntensity={isSelected ? 1.5 : 0.3}
        />
      </mesh>

      <Text
        position={[0, 0.3, 0]}
        fontSize={0.18}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
      >
        n={level.n}
      </Text>
    </group>
  );
}
