import React, { useMemo } from 'react';
import * as THREE from 'three';
import { Text } from '@react-three/drei';
import { Ward } from '@/types';

interface WardMeshProps {
  ward: Ward;
  floorLevel: number;
  isAffected: boolean;
  isHighlighted: boolean;
}

export const WardMesh: React.FC<WardMeshProps> = ({
  ward,
  floorLevel,
  isAffected,
  isHighlighted,
}) => {
  const yOffset = (floorLevel - 1) * 8;

  const material = useMemo(() => {
    const baseColor = isAffected ? '#FF4D4F' : ward.color;
    return new THREE.MeshStandardMaterial({
      color: baseColor,
      transparent: true,
      opacity: isHighlighted || isAffected ? 0.7 : 0.3,
      emissive: isAffected ? '#FF4D4F' : isHighlighted ? ward.color : '#000000',
      emissiveIntensity: isAffected ? 0.3 : isHighlighted ? 0.2 : 0,
    });
  }, [ward.color, isAffected, isHighlighted]);

  return (
    <group position={[ward.position.x, yOffset + ward.position.y, ward.position.z]}>
      <mesh>
        <boxGeometry
          args={[ward.size.width, ward.size.height, ward.size.depth]}
        />
        <primitive object={material} attach="material" />
      </mesh>
      <mesh position={[0, ward.size.height / 2 + 0.05, 0]}>
        <boxGeometry args={[ward.size.width + 0.1, 0.1, ward.size.depth + 0.1]} />
        <meshStandardMaterial
          color={isAffected ? '#FF4D4F' : ward.color}
          emissive={isAffected ? '#FF4D4F' : ward.color}
          emissiveIntensity={0.5}
        />
      </mesh>
      <Text
        position={[0, ward.size.height + 0.5, 0]}
        fontSize={0.5}
        color="#1D2129"
        anchorX="center"
        anchorY="middle"
        maxWidth={ward.size.width - 0.5}
      >
        {ward.name}
      </Text>
    </group>
  );
};

export default WardMesh;
