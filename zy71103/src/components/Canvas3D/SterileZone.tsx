import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { SterileZone as SterileZoneType } from '../../types';
import * as THREE from 'three';

interface SterileZoneProps {
  data: SterileZoneType;
  isSelected: boolean;
  isHovered: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
  onDragEnd: (position: { x: number; y: number; z: number }) => void;
}

export const SterileZone: React.FC<SterileZoneProps> = ({
  data,
  isSelected,
  isHovered,
  onSelect,
  onHover,
  onDragEnd,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const { position, rotation, width, depth, color } = data;

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(position.x, position.y, position.z);
      groupRef.current.rotation.set(rotation.x, rotation.y, rotation.z);
    }
  });

  const borderColor = isSelected ? '#165DFF' : isHovered ? '#4096ff' : color;

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
