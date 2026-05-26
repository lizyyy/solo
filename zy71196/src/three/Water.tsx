import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import type { LowArea } from '../game/types';

interface WaterProps {
  lowArea: LowArea;
  onClick: () => void;
  isSelected: boolean;
}

export function Water({ lowArea, onClick, isSelected }: WaterProps) {
  const meshRef = useRef<Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      const time = state.clock.getElapsedTime();
      meshRef.current.position.y = 0.02 + Math.sin(time * 2) * 0.01;
    }
  });

  const waterHeight = (lowArea.waterLevel / 100) * 0.3;
  const opacity = 0.3 + (lowArea.waterLevel / 100) * 0.5;

  const getColor = () => {
    if (lowArea.waterLevel >= 90) return '#FF0000';
    if (lowArea.waterLevel >= 70) return '#FF6600';
    if (lowArea.waterLevel >= 40) return '#FFCC00';
    return '#4488FF';
  };

  return (
    <group position={[lowArea.position.x, 0, lowArea.position.y]}>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.01, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <ringGeometry args={[lowArea.position.radius * 0.8, lowArea.position.radius, 32]} />
        <meshBasicMaterial
          color={lowArea.inspected ? '#88CCFF' : '#666666'}
          transparent
          opacity={0.3}
          side={2}
        />
      </mesh>

      {waterHeight > 0.01 && (
        <mesh
          ref={meshRef}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.02, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onClick();
          }}
        >
          <circleGeometry args={[lowArea.position.radius * 0.9, 32]} />
          <meshStandardMaterial
            color={getColor()}
            transparent
            opacity={opacity}
            metalness={0.1}
            roughness={0.1}
            emissive={isSelected ? '#FFFF00' : '#000000'}
            emissiveIntensity={isSelected ? 0.2 : 0}
          />
        </mesh>
      )}

      {lowArea.waterLevel > 0 && (
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.02, 0.02, waterHeight, 8]} />
          <meshStandardMaterial
            color={getColor()}
            transparent
            opacity={0.8}
          />
        </mesh>
      )}

      {lowArea.pumped && (
        <mesh position={[0, 0.3, 0]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#00FF00" />
        </mesh>
      )}
    </group>
  );
}
