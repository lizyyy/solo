import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { LightRay } from '../../types';
import { calculateDeflectionColor } from '../../physics/geodesic';

interface LightRays3DProps {
  rays: LightRay[];
  visible: boolean;
  onRayClick: (ray: LightRay) => void;
  selectedId?: string;
}

export function LightRays3D({ rays, visible, onRayClick, selectedId }: LightRays3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const animationRef = useRef(0);

  useFrame(() => {
    animationRef.current = (animationRef.current + 0.002) % 1;
    if (groupRef.current) {
      groupRef.current.children.forEach((child, index) => {
        if (child instanceof THREE.Line) {
          const material = child.material as THREE.LineBasicMaterial;
          const pulse = 0.6 + 0.4 * Math.sin(animationRef.current * Math.PI * 2 + index * 0.3);
          material.opacity = pulse;
        }
      });
    }
  });

  const rayMeshes = useMemo(() => {
    return rays.map((ray) => {
      const points = ray.pathPoints.map(p => new THREE.Vector3(p[0], p[1], p[2]));
      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const color = calculateDeflectionColor(ray.deflectionAngle, ray.pathType);
      const isSelected = ray.id === selectedId;

      return {
        id: ray.id,
        geometry,
        color,
        isSelected,
        ray,
      };
    });
  }, [rays, selectedId]);

  if (!visible) return null;

  return (
    <group ref={groupRef}>
      {rayMeshes.map(({ id, geometry, color, isSelected, ray }) => (
        <lineSegments
          key={id}
          onClick={(e) => {
            (e as any).stopPropagation();
            onRayClick(ray);
          }}
        >
          <bufferGeometry attach="geometry" {...geometry} />
          <lineBasicMaterial
            attach="material"
            color={isSelected ? '#ffffff' : color}
            transparent
            opacity={0.8}
            linewidth={isSelected ? 3 : 1}
          />
        </lineSegments>
      ))}

      {rays.map((ray) => {
        if (ray.pathPoints.length < 2) return null;
        const flowIndex = Math.floor(animationRef.current * (ray.pathPoints.length - 1));
        const point = ray.pathPoints[Math.min(flowIndex, ray.pathPoints.length - 1)];

        return (
          <mesh
            key={`particle-${ray.id}`}
            position={new THREE.Vector3(point[0], point[1], point[2])}
          >
            <sphereGeometry args={[0.05, 8, 8]} />
            <meshBasicMaterial color={calculateDeflectionColor(ray.deflectionAngle, ray.pathType)} />
          </mesh>
        );
      })}
    </group>
  );
}
