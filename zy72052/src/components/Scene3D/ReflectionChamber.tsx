import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Point } from '@/types';
import { getStatusColor } from './statusColors';

interface ReflectionChamberProps {
  point: Point;
  isSelected: boolean;
  isInRayPath: boolean;
  onClick: (id: string) => void;
}

export function ReflectionChamber({ point, isSelected, isInRayPath, onClick }: ReflectionChamberProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  const position = useMemo(() => {
    if (point.x === null || point.y === null || point.z === null) {
      return [5, 0.01, 5] as [number, number, number];
    }
    return [
      point.x - 5,
      point.y,
      point.z - 5
    ] as [number, number, number];
  }, [point.x, point.y, point.z]);

  const color = useMemo(() => getStatusColor(point.status), [point.status]);

  useFrame((_, delta) => {
    if (isSelected && meshRef.current) {
      meshRef.current.scale.setScalar(1 + Math.sin(Date.now() * 0.005) * 0.15);
    } else if (meshRef.current) {
      const target = 1;
      meshRef.current.scale.lerp(new THREE.Vector3(target, target, target), delta * 5);
    }

    if (glowRef.current) {
      const targetOpacity = isSelected ? 0.6 : isInRayPath ? 0.3 : 0.1;
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, targetOpacity, delta * 5);
    }
  });

  const hasCoords = point.x !== null && point.y !== null && point.z !== null;

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick(point.id);
        }}
      >
        <boxGeometry args={[0.35, 0.35, 0.35]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.8 : isInRayPath ? 0.4 : 0.2}
          transparent={!hasCoords}
          opacity={hasCoords ? 1 : 0.4}
        />
      </mesh>

      <mesh ref={glowRef}>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.1} />
      </mesh>

      {isSelected && (
        <mesh position={[0, 0.45, 0]}>
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
    </group>
  );
}
