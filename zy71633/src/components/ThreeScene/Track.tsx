import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getTemperatureColor } from '../../physics/simulation';

interface TrackProps {
  length: number;
  temperature: number;
  isHighlighted?: boolean;
}

export function Track({ length, temperature, isHighlighted }: TrackProps) {
  const meshRef = useRef<THREE.Group>(null);
  const leftRailRef = useRef<THREE.Mesh>(null);
  const rightRailRef = useRef<THREE.Mesh>(null);

  const tempColor = getTemperatureColor(temperature);

  useFrame(() => {
    if (meshRef.current && isHighlighted) {
      meshRef.current.scale.setScalar(1 + Math.sin(Date.now() * 0.01) * 0.02);
    }
  });

  return (
    <group ref={meshRef}>
      <mesh ref={leftRailRef} position={[-length / 2, 0, 0.05]}>
        <boxGeometry args={[length, 0.02, 0.02]} />
        <meshStandardMaterial
          color={tempColor}
          metalness={0.8}
          roughness={0.2}
          emissive={isHighlighted ? '#00d4ff' : '#000000'}
          emissiveIntensity={isHighlighted ? 0.3 : 0}
        />
      </mesh>
      <mesh ref={rightRailRef} position={[-length / 2, 0, -0.05]}>
        <boxGeometry args={[length, 0.02, 0.02]} />
        <meshStandardMaterial
          color={tempColor}
          metalness={0.8}
          roughness={0.2}
          emissive={isHighlighted ? '#00d4ff' : '#000000'}
          emissiveIntensity={isHighlighted ? 0.3 : 0}
        />
      </mesh>
      <mesh position={[-length / 2, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.15, length]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  );
}
