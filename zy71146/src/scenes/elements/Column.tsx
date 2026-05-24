import { useRef } from 'react';
import { Mesh } from 'three';
import { useFrame } from '@react-three/fiber';
import { Column as ColumnType } from '@/types';
import { useSceneStore } from '@/store/sceneStore';

interface ColumnProps {
  data: ColumnType;
  onClick?: () => void;
}

export function Column({ data, onClick }: ColumnProps) {
  const meshRef = useRef<Mesh>(null);
  const selectedElement = useSceneStore(state => state.selectedElement);
  const isSelected = selectedElement === data.id;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.y = data.height / 2;
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[data.position[0], data.height / 2, data.position[2]]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[data.radius, data.radius, data.height, 16]} />
      <meshStandardMaterial
        color={isSelected ? '#ff9800' : '#607d8b'}
        metalness={0.3}
        roughness={0.7}
      />
      {isSelected && (
        <meshBasicMaterial
          color="#ff9800"
          transparent
          opacity={0.3}
          side={2}
        />
      )}
    </mesh>
  );
}
