import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { ContainerSlot } from '@/types';
import { useYardStore } from '@/store/useYardStore';

interface ContainerSlot3DProps {
  slot: ContainerSlot;
  isInConflict: boolean;
}

const getContainerColor = (type: string, isSelected: boolean, isInConflict: boolean) => {
  if (isInConflict) return '#FF6B35';
  if (isSelected) return '#FFD700';
  
  switch (type) {
    case 'reefer':
      return '#3498DB';
    case 'hazardous':
      return '#E74C3C';
    default:
      return '#0F4C81';
  }
};

export function ContainerSlot3D({ slot, isInConflict }: ContainerSlot3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const { selectedObjectId, setSelectedObject } = useYardStore();
  const isSelected = selectedObjectId === slot.id;

  useFrame((state) => {
    if (meshRef.current && (isInConflict || isSelected)) {
      meshRef.current.position.y = slot.position.y + Math.sin(state.clock.elapsedTime * 3) * 0.05;
    }
  });

  const width = slot.size === '40ft' ? 2.8 : 1.4;
  const height = 1.4;
  const depth = 2.6;

  return (
    <group position={[slot.position.x, slot.position.y, slot.position.z]}>
      {slot.status !== 'empty' && (
        <mesh
          ref={meshRef}
          position={[0, height / 2, 0]}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedObject(slot.id, 'slot');
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            setHovered(false);
            document.body.style.cursor = 'auto';
          }}
          castShadow
        >
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial
            color={getContainerColor(slot.container?.type || 'dry', isSelected, isInConflict)}
            metalness={0.3}
            roughness={0.7}
            emissive={isInConflict || isSelected ? '#FF6B35' : '#000000'}
            emissiveIntensity={isInConflict ? 0.3 : isSelected ? 0.2 : 0}
          />
        </mesh>
      )}

      {slot.status === 'empty' && (
        <mesh
          position={[0, 0.05, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            setSelectedObject(slot.id, 'slot');
          }}
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
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial
            color={hovered ? '#3D5A80' : '#2A3F54'}
            transparent
            opacity={0.5}
          />
        </mesh>
      )}

      {isInConflict && (
        <mesh position={[0, height + 0.5, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial color="#FF0000" transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}
