
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { TrashCategory, CATEGORY_COLORS } from '@/types';

interface TrashBin3DProps {
  category: TrashCategory;
  position: [number, number, number];
  isHighlighted: boolean;
  onClick?: () => void;
}

export function TrashBin3D({ category, position, isHighlighted, onClick }: TrashBin3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lidRef = useRef<THREE.Group>(null);
  const [lidOpen, setLidOpen] = useState(false);
  const color = CATEGORY_COLORS[category];

  useFrame((_, delta) => {
    if (lidRef.current) {
      const targetRotation = lidOpen ? -Math.PI / 2.5 : 0;
      lidRef.current.rotation.x += (targetRotation - lidRef.current.rotation.x) * delta * 8;
    }

    if (groupRef.current && isHighlighted) {
      groupRef.current.position.y = position[1] + Math.sin(Date.now() * 0.005) * 0.05;
    } else if (groupRef.current) {
      groupRef.current.position.y += (position[1] - groupRef.current.position.y) * delta * 5;
    }
  });

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setLidOpen(true);
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setLidOpen(false);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (onClick) onClick();
  };

  return (
    <group ref={groupRef} position={position}>
      <group
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        {/* Bin Body */}
        <mesh position={[0, 0.4, 0]} castShadow>
          <cylinderGeometry args={[0.45, 0.4, 0.8, 32]} />
          <meshStandardMaterial
            color={color}
            roughness={0.6}
            metalness={0.1}
            emissive={isHighlighted ? color : '#000000'}
            emissiveIntensity={isHighlighted ? 0.2 : 0}
          />
        </mesh>

        {/* Bin Rim */}
        <mesh position={[0, 0.82, 0]} castShadow>
          <torusGeometry args={[0.43, 0.05, 16, 32]} />
          <meshStandardMaterial
            color="#333333"
            roughness={0.4}
            metalness={0.3}
          />
        </mesh>

        {/* Lid Group */}
        <group ref={lidRef} position={[0, 0.85, 0.4]}>
          <mesh position={[0, 0, -0.4]} castShadow>
            <cylinderGeometry args={[0.46, 0.46, 0.06, 32]} />
            <meshStandardMaterial
              color={color}
              roughness={0.5}
              metalness={0.1}
            />
          </mesh>
          {/* Lid Handle */}
          <mesh position={[0, 0.06, -0.4]} castShadow>
            <boxGeometry args={[0.15, 0.08, 0.04]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
        </group>

        {/* Highlight Ring */}
        {isHighlighted && (
          <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.5, 0.6, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>

      {/* Category Label */}
      <mesh position={[0, 0.4, 0.46]}>
        <planeGeometry args={[0.3, 0.3]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

export default TrashBin3D;
