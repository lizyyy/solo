import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { statusColors } from '@/types';
import type { ObstacleStatus } from '@/types';

interface SafetySphereProps {
  position: [number, number, number];
  radius: number;
  status: ObstacleStatus;
  isActive: boolean;
}

export function SafetySphere({ position, radius, status, isActive }: SafetySphereProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const outerRingRef = useRef<THREE.Mesh>(null);

  const color = statusColors[status];

  const sphereMaterial = useMemo(() => {
    const hexColor = new THREE.Color(color);
    return new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
  }, [color]);

  const edgeMaterial = useMemo(() => {
    const hexColor = new THREE.Color(color);
    return new THREE.MeshBasicMaterial({
      color: hexColor,
      transparent: true,
      opacity: 0.8,
      wireframe: true,
    });
  }, [color]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.1;
    }
    if (outerRingRef.current && isActive) {
      outerRingRef.current.rotation.z += delta * 0.5;
    }
  });

  return (
    <group position={position}>
      <mesh ref={meshRef} scale={isActive ? [1.02, 1.02, 1.02] : [1, 1, 1]}>
        <sphereGeometry args={[radius, 32, 32]} />
        <primitive object={sphereMaterial} attach="material" />
      </mesh>

      <mesh>
        <sphereGeometry args={[radius, 32, 32]} />
        <primitive object={edgeMaterial} attach="material" />
      </mesh>

      {isActive && (
        <mesh ref={outerRingRef} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius * 1.1, radius * 1.15, 64]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      <mesh position={[0, radius + 0.3, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>

      <mesh position={[0, radius + 0.6, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}
