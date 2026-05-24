import { useMemo } from 'react';
import { Building } from '@/types';
import * as THREE from 'three';

interface BuildingsProps {
  buildings: Building[];
  visible?: boolean;
}

export const Buildings = ({ buildings, visible = true }: BuildingsProps) => {
  const buildingData = useMemo(() => {
    return buildings.map(building => ({
      ...building,
      position: [
        building.position.x,
        building.height / 2,
        building.position.z
      ] as [number, number, number],
      size: [building.width, building.height, building.depth] as [number, number, number]
    }));
  }, [buildings]);

  if (!visible) return null;

  return (
    <group>
      {buildingData.map((building) => (
        <group key={building.id}>
          <mesh position={building.position} castShadow receiveShadow>
            <boxGeometry args={building.size} />
            <meshStandardMaterial 
              color={building.color}
              roughness={0.7}
              metalness={0.3}
            />
          </mesh>
          <mesh position={[
            building.position[0],
            building.height + 0.5,
            building.position[2]
          ]}>
            <ringGeometry args={[0.3, 0.5, 8]} />
            <meshBasicMaterial color="#06B6D4" transparent opacity={0.8} />
          </mesh>
          <mesh position={[
            building.position[0],
            building.height + 0.5,
            building.position[2]
          ]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.3, 0.5, 8]} />
            <meshBasicMaterial color="#06B6D4" transparent opacity={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
};

export const Ground = () => {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial 
          color="#1E293B"
          roughness={0.9}
          metalness={0.1}
        />
      </mesh>
      <gridHelper 
        args={[300, 60, '#334155', '#1E293B']} 
        position={[0, 0.01, 0]}
      />
    </group>
  );
};
