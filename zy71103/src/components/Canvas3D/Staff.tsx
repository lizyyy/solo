import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Staff as StaffType } from '../../types';
import { getPositionOnPath, generateSmoothPathPoints } from '../../utils/pathUtils';
import * as THREE from 'three';

interface StaffProps {
  data: StaffType;
  isSelected: boolean;
  isHovered: boolean;
  currentTime: number;
  isPlaying: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
  onDragEnd: (position: { x: number; y: number; z: number }) => void;
}

export const Staff: React.FC<StaffProps> = ({
  data,
  isSelected,
  isHovered,
  currentTime,
  isPlaying,
  onSelect,
  onHover,
  onDragEnd,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const { color, path } = data;

  const animPosition = useMemo(() => {
    if (path.length === 0) return { pos: data.position, rot: 0 };
    if (!isPlaying && path.length > 0) return { pos: path[0].position, rot: 0 };
    const result = getPositionOnPath(path, currentTime);
    return result ? { pos: result.position, rot: result.rotation } : { pos: data.position, rot: 0 };
  }, [path, currentTime, isPlaying, data.position]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(animPosition.pos.x, animPosition.pos.y, animPosition.pos.z);
      groupRef.current.rotation.y = animPosition.rot;
    }
  });

  const bodyColor = isSelected ? '#4096ff' : isHovered ? '#69b1ff' : color;

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
      <mesh position={[0, 0.9, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.18, 0.8, 16]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>

      <mesh position={[0, 1.55, 0]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#ffdbac" />
      </mesh>

      <mesh position={[0, 1.7, 0]} castShadow>
        <cylinderGeometry args={[0.18, 0.18, 0.08, 16]} />
        <meshStandardMaterial color={bodyColor} />
      </mesh>

      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.22, 0.5, 16]} />
        <meshStandardMaterial color="#4a4a4a" />
      </mesh>

      <mesh position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.25, 0.04, 16]} />
        <meshStandardMaterial color="#333333" />
      </mesh>

      {isSelected && (
        <mesh position={[0, 0.9, 0]}>
          <cylinderGeometry args={[0.4, 0.4, 2, 16]} />
          <meshBasicMaterial color="#165DFF" transparent opacity={0.1} wireframe />
        </mesh>
      )}
    </group>
  );
};
