import React from 'react';
import * as THREE from 'three';
import type { SterileZone as SterileZoneType } from '../../types';

interface SterileZoneProps {
  data: SterileZoneType;
  isSelected: boolean;
  isHovered: boolean;
}

export const SterileZone: React.FC<SterileZoneProps> = ({
  data,
  isSelected,
  isHovered,
}) => {
  const { width, depth, color } = data;

  const borderColor = isSelected ? '#165DFF' : isHovered ? '#4096ff' : color;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[Math.min(width, depth) / 2 - 0.1, Math.min(width, depth) / 2, 64]} />
        <meshBasicMaterial color={borderColor} transparent opacity={0.8} side={THREE.DoubleSide} />
      </mesh>

      {[-1, 1].map((x) =>
        [-1, 1].map((z) => (
          <mesh key={`corner-${x}-${z}`} position={[(x * width) / 2, 0.05, (z * depth) / 2]}>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color={borderColor} />
          </mesh>
        ))
      )}

      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <planeGeometry args={[width + 0.2, depth + 0.2]} />
          <meshBasicMaterial color="#165DFF" transparent opacity={0.1} />
        </mesh>
      )}
    </group>
  );
};
