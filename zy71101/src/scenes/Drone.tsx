import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Point3D, unitConversion } from '@/types';
import * as THREE from 'three';

interface DroneProps {
  position: Point3D | null;
  visible?: boolean;
}

export const Drone = ({ position, visible = true }: DroneProps) => {
  const groupRef = useRef<THREE.Group>(null);
  const propellerRef1 = useRef<THREE.Mesh>(null);
  const propellerRef2 = useRef<THREE.Mesh>(null);
  const propellerRef3 = useRef<THREE.Mesh>(null);
  const propellerRef4 = useRef<THREE.Mesh>(null);

  const pos = useMemo(() => {
    if (!position) return [0, 10, 0] as [number, number, number];
    return [
      position.x,
      unitConversion.toMeters(position.y, position.unit),
      position.z
    ] as [number, number, number];
  }, [position]);

  useFrame((_, delta) => {
    if (propellerRef1.current) {
      propellerRef1.current.rotation.y += delta * 50;
    }
    if (propellerRef2.current) {
      propellerRef2.current.rotation.y += delta * 50;
    }
    if (propellerRef3.current) {
      propellerRef3.current.rotation.y += delta * 50;
    }
    if (propellerRef4.current) {
      propellerRef4.current.rotation.y += delta * 50;
    }
    if (groupRef.current) {
      groupRef.current.position.y = pos[1] + Math.sin(Date.now() * 0.002) * 0.3;
    }
  });

  if (!visible || !position) return null;

  const propellerPositions = [
    [1.5, 0.5, 1.5] as [number, number, number],
    [-1.5, 0.5, 1.5] as [number, number, number],
    [1.5, 0.5, -1.5] as [number, number, number],
    [-1.5, 0.5, -1.5] as [number, number, number]
  ];

  const propellerRefs = [propellerRef1, propellerRef2, propellerRef3, propellerRef4];

  return (
    <group ref={groupRef} position={pos}>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[2, 0.5, 2]} />
        <meshStandardMaterial 
          color="#1E293B"
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      <mesh position={[0, 0.8, 0]}>
        <sphereGeometry args={[0.6, 16, 16]} />
        <meshStandardMaterial 
          color="#06B6D4"
          metalness={0.5}
          roughness={0.3}
          emissive="#06B6D4"
          emissiveIntensity={0.3}
        />
      </mesh>

      {propellerPositions.map((p, i) => (
        <group key={i} position={p}>
          <mesh position={[0, -0.3, 0]}>
            <cylinderGeometry args={[0.1, 0.1, 0.6, 8]} />
            <meshStandardMaterial color="#475569" />
          </mesh>
          <mesh ref={propellerRefs[i]}>
            <boxGeometry args={[2, 0.05, 0.3]} />
            <meshStandardMaterial 
              color="#94A3B8"
              metalness={0.6}
              roughness={0.3}
            />
          </mesh>
        </group>
      ))}

      <pointLight 
        position={[0, 2, 0]} 
        color="#06B6D4" 
        intensity={0.5} 
        distance={20}
      />

      <mesh position={[0, -2, 0]}>
        <ringGeometry args={[2, 2.5, 32]} />
        <meshBasicMaterial 
          color="#06B6D4" 
          transparent 
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
};
