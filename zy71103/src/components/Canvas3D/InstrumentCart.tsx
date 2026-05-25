import React, { useRef } from 'react';
import { useThree } from '@react-three/fiber';
import type { InstrumentCart as InstrumentCartType } from '../../types';
import * as THREE from 'three';

interface InstrumentCartProps {
  data: InstrumentCartType;
  isSelected: boolean;
  isHovered: boolean;
  onClick?: () => void;
}

export const InstrumentCart: React.FC<InstrumentCartProps> = ({
  data,
  isSelected,
  isHovered,
  onClick,
}) => {
  const { width, depth, height } = data;
  const groupRef = useRef<THREE.Group>(null);

  const color = isSelected ? '#4096ff' : isHovered ? '#69b1ff' : '#d9d9d9';
  const shelfColor = '#f0f0f0';

  const handleClick = (e: any) => {
    e.stopPropagation();
    if (onClick) onClick();
  };

  return (
    <group ref={groupRef} onClick={handleClick}>
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
