import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { STONE_RADIUS, StoneColor } from '../../types';
import * as THREE from 'three';

interface CurlingStoneProps {
  position: [number, number, number];
  color: StoneColor;
  isSelected: boolean;
  rotation: number;
  onClick?: () => void;
}

export const CurlingStone: React.FC<CurlingStoneProps> = ({
  position,
  color,
  isSelected,
  rotation,
  onClick
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const handleColor = color === 'red' ? '#cc3333' : '#e6c84d';

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = rotation;
    }
  });

  return (
    <group ref={groupRef} position={position} onClick={onClick}>
      <mesh position={[0, 0.05, 0]} castShadow>
        <cylinderGeometry args={[STONE_RADIUS, STONE_RADIUS * 0.95, 0.1, 32]} />
        <meshStandardMaterial 
          color="#4a5568"
          roughness={0.6}
          metalness={0.3}
        />
      </mesh>
      
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[STONE_RADIUS * 0.5, STONE_RADIUS * 0.45, 0.04, 32]} />
        <meshStandardMaterial 
          color={handleColor}
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>

      <mesh position={[0, 0.09, 0]}>
        <torusGeometry args={[STONE_RADIUS * 0.55, 0.015, 8, 32]} />
        <meshStandardMaterial 
          color={handleColor}
          roughness={0.4}
          metalness={0.4}
        />
      </mesh>

      {isSelected && (
        <mesh position={[0, 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[STONE_RADIUS + 0.05, STONE_RADIUS + 0.08, 64]} />
          <meshBasicMaterial color="#165DFF" transparent opacity={0.8} side={2} />
        </mesh>
      )}
    </group>
  );
};
