import { useRef, useState } from 'react';
import type { Mesh } from 'three';
import { useFrame } from '@react-three/fiber';
import type { CargoItem } from '@/types';

interface CargoMeshProps {
  cargo: CargoItem;
  position: { x: number; y: number; z: number };
  onClick?: () => void;
}

export function CargoMesh({ cargo, position, onClick }: CargoMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = cargo.isDangerous 
    ? '#ff0000' 
    : cargo.category.toLowerCase().includes('refrigerated')
      ? '#00aaff'
      : cargo.category.toLowerCase().includes('heavy')
        ? '#888888'
        : '#00ff88';

  useFrame(() => {
    if (meshRef.current && hovered) {
      meshRef.current.scale.setScalar(1.05);
    } else if (meshRef.current) {
      meshRef.current.scale.setScalar(1);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[position.x, position.y, position.z]}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[cargo.width, cargo.height, cargo.length]} />
      <meshStandardMaterial 
        color={color} 
        roughness={0.6}
        metalness={0.3}
        emissive={cargo.isDangerous ? '#330000' : '#000000'}
      />
    </mesh>
  );
}