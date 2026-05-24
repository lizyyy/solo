import { useRef, useState } from 'react';
import { Mesh, Vector3 } from 'three';
import { Text } from '@react-three/drei';
import { Store as StoreType } from '@/types';
import { useSceneStore } from '@/store/sceneStore';

interface StoreProps {
  data: StoreType;
  onClick?: () => void;
}

const categoryColors: Record<string, string> = {
  '餐饮': '#e91e63',
  '服饰': '#9c27b0',
  '家居': '#3f51b5',
  '电子': '#00bcd4',
  '其他': '#607d8b',
};

export function Store({ data, onClick }: StoreProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const selectedElement = useSceneStore(state => state.selectedElement);
  const isSelected = selectedElement === data.id;

  const rotation = data.rotation || [0, 0, 0];
  const color = categoryColors[data.category] || categoryColors['其他'];
  const height = 3.5;

  return (
    <group
      position={[data.position[0], height / 2, data.position[2]]}
      rotation={rotation as [number, number, number]}
    >
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[data.width, height, data.depth]} />
        <meshStandardMaterial
          color={isSelected ? '#ff9800' : '#37474f'}
          emissive={hovered || isSelected ? color : '#000'}
          emissiveIntensity={hovered || isSelected ? 0.15 : 0}
          metalness={0.2}
          roughness={0.8}
        />
      </mesh>

      <mesh position={[0, 0, data.depth / 2 + 0.01]}>
        <planeGeometry args={[data.width * 0.9, height * 0.9]} />
        <meshStandardMaterial
          color="#263238"
          emissive={color}
          emissiveIntensity={0.1}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>

      <mesh position={[0, -height / 2 + 0.3, data.depth / 2 + 0.02]}>
        <planeGeometry args={[data.width * 0.8, 0.6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
        />
      </mesh>

      <Text
        position={[0, -height / 2 + 0.3, data.depth / 2 + 0.03]}
        fontSize={0.35}
        color="#ffffff"
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {data.storeName}
      </Text>

      <mesh position={[0, height / 2 - 0.1, 0]}>
        <boxGeometry args={[data.width * 0.95, 0.15, data.depth * 0.95]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.9}
        />
      </mesh>
    </group>
  );
}
