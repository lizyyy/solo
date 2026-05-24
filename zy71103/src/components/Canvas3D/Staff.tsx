import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Staff as StaffType } from '../../types';
import { getPositionOnPath } from '../../utils/pathUtils';
import * as THREE from 'three';

interface StaffProps {
  data: StaffType;
  isSelected: boolean;
  isHovered: boolean;
  currentTime: number;
}

export const Staff: React.FC<StaffProps> = ({
  data,
  isSelected,
  isHovered,
  currentTime,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const { color, path } = data;

  const animState = useMemo(() => {
    if (path.length === 0) {
      return {
        position: data.position,
        rotation: 0,
      };
    }

    const result = getPositionOnPath(path, currentTime);
    if (result) {
      return result;
    }

    return {
      position: path[0]?.position || data.position,
      rotation: 0,
    };
  }, [path, currentTime, data.position]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(
        animState.position.x,
        animState.position.y,
        animState.position.z
      );
      groupRef.current.rotation.y = animState.rotation;
    }
  });

  const bodyColor = isSelected ? '#4096ff' : isHovered ? '#69b1ff' : color;

  return (
    <group ref={groupRef}>
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
