
import React, { useRef } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { Block, Vector3 } from '../../types';

interface Block3DProps {
  block: Block;
  isSelected: boolean;
  currentPosition: Vector3;
  onSelect: (id: string) => void;
  showLiftingPoints: boolean;
}

export const Block3D: React.FC<Block3DProps> = ({
  block,
  isSelected,
  currentPosition,
  onSelect,
  showLiftingPoints,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onSelect(block.id);
  };

  const edgeColor = isSelected ? '#FFD700' : '#1a1a2e';
  const bodyColor = isSelected ? adjustColor(block.color, 30) : block.color;

  return (
    <group position={[currentPosition.x, currentPosition.y, currentPosition.z]}>
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        onClick={handleClick}
      >
        <boxGeometry args={[block.dimensions.width, block.dimensions.height, block.dimensions.depth]} />
        <meshStandardMaterial
          color={bodyColor}
          metalness={0.3}
          roughness={0.7}
          transparent
          opacity={0.9}
        />
      </mesh>

      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(block.dimensions.width, block.dimensions.height, block.dimensions.depth)]} />
        <lineBasicMaterial color={edgeColor} linewidth={2} />
      </lineSegments>

      {showLiftingPoints && block.liftingPoints.map((lp) => (
        <group key={lp.id} position={[lp.position.x, lp.position.y, lp.position.z]}>
          <mesh>
            <sphereGeometry args={[0.3, 16, 16]} />
            <meshStandardMaterial
              color={lp.isValid ? '#00B42A' : '#F53F3F'}
              emissive={lp.isValid ? '#00B42A' : '#F53F3F'}
              emissiveIntensity={0.3}
            />
          </mesh>
          <mesh position={[lp.direction.x * 0.8, lp.direction.y * 0.8, lp.direction.z * 0.8]}>
            <coneGeometry args={[0.15, 0.5, 8]} />
            <meshStandardMaterial color={lp.isValid ? '#00B42A' : '#F53F3F'} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

function adjustColor(color: string, amount: number): string {
  const hex = color.replace('#', '');
  const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + amount);
  const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + amount);
  const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + amount);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

