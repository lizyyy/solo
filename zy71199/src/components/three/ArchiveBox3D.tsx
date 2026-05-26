import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Text, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

interface ArchiveBox3DProps {
  position: [number, number, number];
  color: string;
  label: string;
  isSelected: boolean;
  onClick: () => void;
}

export default function ArchiveBox3D({ position, color, label, isSelected, onClick }: ArchiveBox3DProps) {
  const meshRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  useFrame(() => {
    if (meshRef.current) {
      const targetY = hovered || isSelected ? 0.15 : 0;
      meshRef.current.position.y += (targetY - meshRef.current.position.y) * 0.1;
    }
  });

  return (
    <group
      ref={meshRef}
      position={position}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
    >
      <RoundedBox args={[0.9, 0.6, 0.5]} radius={0.02} smoothness={4}>
        <meshStandardMaterial
          color={color}
          emissive={isSelected ? color : '#000'}
          emissiveIntensity={isSelected ? 0.3 : 0}
          metalness={0.3}
          roughness={0.6}
        />
      </RoundedBox>
      <mesh position={[0, 0.1, 0.26]}>
        <planeGeometry args={[0.7, 0.15]} />
        <meshStandardMaterial color="#f5e6c8" />
      </mesh>
      <Text
        position={[0, 0.1, 0.27]}
        fontSize={0.06}
        color="#333"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      {isSelected && (
        <mesh position={[0, 0.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.5, 32]} />
          <meshBasicMaterial color="#d4a017" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}