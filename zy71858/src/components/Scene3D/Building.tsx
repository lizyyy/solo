import { useRef, useState } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { BuildingModel } from '@/types';
import { useBuildingStore } from '@/store/useBuildingStore';

interface BuildingProps {
  building: BuildingModel;
}

export function Building({ building }: BuildingProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { selectedBuildingId, setSelectedBuildingId } = useBuildingStore();
  const isSelected = selectedBuildingId === building.id;

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    setSelectedBuildingId(isSelected ? null : building.id);
  };

  const displayColor = isSelected
    ? '#2dd4bf'
    : hovered
    ? '#64748b'
    : building.color;

  return (
    <mesh
      ref={meshRef}
      position={[
        building.position.x,
        building.position.y + building.dimensions.height / 2,
        building.position.z,
      ]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <boxGeometry
        args={[
          building.dimensions.width,
          building.dimensions.height,
          building.dimensions.depth,
        ]}
      />
      <meshStandardMaterial
        color={displayColor}
        roughness={0.8}
        metalness={0.1}
      />
      {isSelected && (
        <lineSegments>
          <edgesGeometry
            args={[
              new THREE.BoxGeometry(
                building.dimensions.width + 0.5,
                building.dimensions.height + 0.5,
                building.dimensions.depth + 0.5
              ),
            ]}
          />
          <lineBasicMaterial color="#2dd4bf" linewidth={2} />
        </lineSegments>
      )}
    </mesh>
  );
}
