import { useRef, ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface VinylRecordProps {
  rotationSpeed?: number;
  children?: ReactNode;
}

export default function VinylRecord({ rotationSpeed = 0.5, children }: VinylRecordProps) {
  const groupRef = useRef<THREE.Group>(null);
  const recordRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += rotationSpeed * delta;
    }
  });

  const recordRadius = 1.4;
  const labelRadius = 0.5;
  const spindleRadius = 0.08;
  const thickness = 0.08;

  return (
    <group ref={groupRef} position={[0, 0.45, 0]}>
      <mesh ref={recordRef} receiveShadow castShadow>
        <cylinderGeometry args={[recordRadius, recordRadius, thickness, 128]} />
        <meshStandardMaterial
          color="#0a0a0a"
          roughness={0.3}
          metalness={0.1}
        />
      </mesh>

      <mesh position={[0, thickness / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[labelRadius, recordRadius - 0.02, 128]} />
        <meshStandardMaterial
          color="#111111"
          roughness={0.2}
          metalness={0.2}
        />
      </mesh>

      <mesh position={[0, thickness / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[labelRadius, 64]} />
        <meshStandardMaterial
          color="#d4af37"
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      <mesh position={[0, thickness / 2 + 0.003, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[labelRadius - 0.05, labelRadius, 64]} />
        <meshStandardMaterial
          color="#b8960c"
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>

      <mesh position={[0, thickness / 2 + 0.1, 0]}>
        <cylinderGeometry args={[spindleRadius, spindleRadius, 0.2, 32]} />
        <meshStandardMaterial
          color="#8b7355"
          roughness={0.5}
          metalness={0.3}
        />
      </mesh>

      {Array.from({ length: 5 }).map((_, i) => (
        <mesh
          key={`groove-${i}`}
          position={[0, thickness / 2 + 0.0015, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[
            labelRadius + 0.1 + i * 0.15,
            labelRadius + 0.11 + i * 0.15,
            128
          ]} />
          <meshStandardMaterial
            color="#1a1a1a"
            roughness={0.15}
            metalness={0.25}
          />
        </mesh>
      ))}

      <group position={[0, thickness / 2 + 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        {children}
      </group>
    </group>
  );
}
