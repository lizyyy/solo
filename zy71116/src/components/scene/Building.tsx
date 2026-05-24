import { useRef } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { Building as BuildingType } from '../../types';

interface BuildingProps {
  building: BuildingType;
  onClick?: (building: BuildingType) => void;
}

export const BuildingModel = ({ building, onClick }: BuildingProps) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick?.(building);
  };

  return (
    <group position={[building.position.x, building.position.y, building.position.z]}>
      <mesh
        ref={meshRef}
        position={[0, building.size.y / 2, 0]}
        onClick={handleClick}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[building.size.x, building.size.y, building.size.z]} />
        <meshStandardMaterial
          color={building.color}
          roughness={0.7}
          metalness={0.1}
        />
      </mesh>

      <mesh position={[0, building.size.y + 0.1, 0]}>
        <boxGeometry args={[building.size.x + 1, 0.2, building.size.z + 1]} />
        <meshStandardMaterial
          color={building.color}
          roughness={0.5}
          metalness={0.2}
        />
      </mesh>

      {Array.from({ length: Math.floor(building.size.y / 4) }).map((_, floor) => (
        <group key={floor} position={[0, floor * 4 + 2.5, 0]}>
          {[-1, 1].map((side) => (
            <mesh
              key={side}
              position={[
                (building.size.x / 2 - 1) * side,
                0,
                building.size.z / 2 + 0.01,
              ]}
            >
              <planeGeometry args={[1.5, 2]} />
              <meshStandardMaterial
                color="#87CEEB"
                emissive="#87CEEB"
                emissiveIntensity={0.1}
                transparent
                opacity={0.8}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};
