import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { InstrumentCart as InstrumentCartType } from '../../types';
import * as THREE from 'three';

interface InstrumentCartProps {
  data: InstrumentCartType;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
  onDragEnd: (position: { x: number; y: number; z: number }) => void;
}

export const InstrumentCart: React.FC<InstrumentCartProps> = ({
  data,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onDragEnd,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const { position, rotation, width, depth, height } = data;

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(position.x, position.y, position.z);
      groupRef.current.rotation.set(rotation.x, rotation.y, rotation.z);
    }
  });

  const color = isSelected ? '#4096ff' : isHovered ? '#69b1ff' : '#d9d9d9';
  const shelfColor = '#f0f0f0';

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
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} />
      </mesh>

      <mesh position={[0, height * 0.3, 0]} castShadow>
        <boxGeometry args={[width - 0.05, 0.05, depth - 0.05]} />
        <meshStandardMaterial color={shelfColor} />
      </mesh>

      <mesh position={[0, height * 0.6, 0]} castShadow>
        <boxGeometry args={[width - 0.05, 0.05, depth - 0.05]} />
        <meshStandardMaterial color={shelfColor} />
      </mesh>

      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <mesh
            key={`wheel-${x}-${z}`}
            position={[(x * width) / 2 - 0.08, 0.08, (z * depth) / 2 - 0.08]}
            castShadow
          >
            <cylinderGeometry args={[0.06, 0.06, 0.16, 16]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
        ))
      )}

      {isSelected && (
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width + 0.1, height + 0.1, depth + 0.1]} />
          <meshBasicMaterial color="#165DFF" transparent opacity={0.1} wireframe />
        </mesh>
      )}
    </group>
  );
};
