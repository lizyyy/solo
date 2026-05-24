import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Building as BuildingType } from '../../types';
import { useAppStore } from '../../store/useAppStore';

interface BuildingProps {
  building: BuildingType;
}

export default function Building({ building }: BuildingProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const edgesRef = useRef<THREE.LineSegments>(null);
  const { highlightedBuilding, selectedBuildings } = useAppStore();
  
  const isHighlighted = highlightedBuilding === building.id;
  const isSelected = selectedBuildings.includes(building.id);

  const { position, dimensions, color } = building;
  
  const edgesGeometry = useMemo(() => {
    const box = new THREE.BoxGeometry(dimensions.width, dimensions.height, dimensions.depth);
    return new THREE.EdgesGeometry(box);
  }, [dimensions]);

  const materialColor = useMemo(() => {
    if (isHighlighted) return '#ef4444';
    if (isSelected) return '#3b82f6';
    return color;
  }, [isHighlighted, isSelected, color]);

  useFrame(() => {
    if (meshRef.current) {
      const material = meshRef.current.material as THREE.MeshStandardMaterial;
      material.opacity = isHighlighted ? 0.6 : 0.9;
    }
  });

  return (
    <group position={[position[0], position[1] + dimensions.height / 2, position[2]]}>
      <mesh ref={meshRef} castShadow receiveShadow>
        <boxGeometry args={[dimensions.width, dimensions.height, dimensions.depth]} />
        <meshStandardMaterial 
          color={materialColor}
          transparent
          opacity={0.9}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>
      
      <lineSegments ref={edgesRef} geometry={edgesGeometry}>
        <lineBasicMaterial 
          color={isHighlighted ? '#ef4444' : '#94a3b8'} 
          transparent 
          opacity={0.6} 
        />
      </lineSegments>

      {Array.from({ length: building.floors - 1 }).map((_, i) => (
        <mesh 
          key={`floor-${i}`} 
          position={[0, -dimensions.height / 2 + (i + 1) * (dimensions.height / building.floors), 0]}
        >
          <planeGeometry args={[dimensions.width - 0.2, dimensions.depth - 0.2]} />
          <meshBasicMaterial color="#475569" side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}
