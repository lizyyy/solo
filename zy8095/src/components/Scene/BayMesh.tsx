import { useRef, useState } from 'react';
import type { Mesh, MeshStandardMaterial } from 'three';
import { useFrame } from '@react-three/fiber';
import type { Bay } from '@/types';

interface BayMeshProps {
  bay: Bay;
  onClick?: () => void;
  loadPercentage: number;
}

export function BayMesh({ bay, onClick, loadPercentage }: BayMeshProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const color = loadPercentage > 100 
    ? '#ff4444' 
    : loadPercentage > 80 
      ? '#ffaa00' 
      : loadPercentage > 50 
        ? '#aaff00' 
        : '#44ff44';

  useFrame(() => {
    if (meshRef.current && hovered) {
      const material = meshRef.current.material as MeshStandardMaterial;
      material.emissive.setHex(0x444444);
    } else if (meshRef.current) {
      const material = meshRef.current.material as MeshStandardMaterial;
      material.emissive.setHex(0x000000);
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={[bay.position.x, bay.position.y, bay.position.z]}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <boxGeometry args={[bay.dimensions.width, bay.dimensions.height, bay.dimensions.depth]} />
      <meshStandardMaterial 
        color={color} 
        transparent 
        opacity={bay.isDeck ? 0.7 : 0.5}
        wireframe={false}
        roughness={0.8}
        metalness={0.2}
      />
    </mesh>
  );
}