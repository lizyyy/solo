import { useRef } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { PointOfInterest as POIType } from '../../types';
import * as THREE from 'three';

interface PointOfInterestProps {
  point: POIType;
  isSelected: boolean;
  onClick: (point: POIType) => void;
}

export const PointOfInterest = ({ point, isSelected, onClick }: PointOfInterestProps) => {
  const meshRef = useRef<THREE.Group>(null);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick(point);
  };

  const getColor = () => {
    if (point.type === 'start') {
      return isSelected ? '#00B42A' : '#4CAF50';
    }
    return isSelected ? '#165DFF' : '#4E5969';
  };

  return (
    <group
      ref={meshRef}
      position={[point.position.x, point.position.y, point.position.z]}
      onClick={handleClick}
    >
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.6, 0.8, 0.3, 16]} />
        <meshStandardMaterial
          color={getColor()}
          emissive={getColor()}
          emissiveIntensity={isSelected ? 0.5 : 0.2}
        />
      </mesh>

      <mesh position={[0, 2, 0]}>
        <coneGeometry args={[0.4, 1.5, 6]} />
        <meshStandardMaterial
          color={getColor()}
          emissive={getColor()}
          emissiveIntensity={isSelected ? 0.6 : 0.3}
        />
      </mesh>

      {isSelected && (
        <mesh position={[0, 1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.2, 32]} />
          <meshBasicMaterial
            color={getColor()}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 2, 32]} />
        <meshBasicMaterial
          color={getColor()}
          transparent
          opacity={isSelected ? 0.4 : 0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};
