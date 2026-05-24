import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { RecycleBin as RecycleBinType } from '../../types';
import * as THREE from 'three';

interface RecycleBinProps {
  data: RecycleBinType;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
  onDragEnd: (position: { x: number; y: number; z: number }) => void;
}

export const RecycleBin: React.FC<RecycleBinProps> = ({
  data,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onDragEnd,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const { position, rotation, radius } = data;
  const height = 0.8;

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(position.x, position.y, position.z);
      groupRef.current.rotation.set(rotation.x, rotation.y, rotation.z);
    }
  });

  const bodyColor = isSelected ? '#ff7875' : isHovered ? '#ffa39e' : '#ff4d4f';

  return (
    <group
      ref={groupRef}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onHover(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        onHover(false);
        document.body.style.cursor = 'default';
      }}
    >
      <mesh position={[0, height / 2, 0]} castShadow>
        <cylinderGeometry args={[radius, radius * 0.9, height, 32]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>

      <mesh position={[0, height + 0.02, 0]}>
        <torusGeometry args={[radius, 0.04, 16, 32]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      <mesh position={[0, height * 0.7, 0]}>
        <cylinderGeometry args={[radius * 0.85, radius * 0.85, 0.02, 32]} />
        <meshStandardMaterial color="#1a1a1a" transparent opacity={0.3} />
      </mesh>

      <mesh position={[0, height * 0.4, 0]} rotation={[0, 0, 0]}>
        <boxGeometry args={[radius * 0.3, radius * 0.4, 0.02]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>

      {isSelected && (
        <mesh position={[0, height / 2, 0]}>
          <cylinderGeometry args={[radius + 0.1, radius + 0.1, height + 0.2, 32]} />
          <meshBasicMaterial color="#F53F3F" transparent opacity={0.1} wireframe />
        </mesh>
      )}
    </group>
  );
};
