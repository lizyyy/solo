import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sprinkler as SprinklerType } from '@/types';
import { COLORS } from '@/data/constants';
import * as THREE from 'three';

interface SprinklerProps {
  data: SprinklerType;
  isActive: boolean;
}

export function Sprinkler({ data, isActive }: SprinklerProps) {
  const { position } = data;
  const groupRef = useRef<THREE.Group>(null);
  const sprayRef = useRef<THREE.Mesh>(null);

  const sprayGeometry = useMemo(() => {
    return new THREE.ConeGeometry(0.5, 1.5, 8, 1, true);
  }, []);

  useFrame((_, delta) => {
    if (groupRef.current && isActive) {
      groupRef.current.rotation.y += delta * 2;
    }
    if (sprayRef.current) {
      const material = sprayRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = isActive ? 0.6 : 0.2;
    }
  });

  return (
    <group ref={groupRef} position={position}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.15, 1, 8]} />
        <meshStandardMaterial color="#555" metalness={0.8} roughness={0.3} />
      </mesh>

      <mesh position={[0, -0.3, 0]} rotation={[Math.PI, 0, 0]} castShadow>
        <coneGeometry args={[0.2, 0.4, 8]} />
        <meshStandardMaterial color={COLORS.sprinkler} metalness={0.5} />
      </mesh>

      {isActive && (
        <mesh
          ref={sprayRef}
          position={[0, -1.2, 0]}
          rotation={[Math.PI, 0, 0]}
        >
          <primitive object={sprayGeometry} attach="geometry" />
          <meshBasicMaterial
            color={COLORS.sprinkler}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}