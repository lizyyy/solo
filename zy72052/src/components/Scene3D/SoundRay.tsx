import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { SoundRayPath } from '@/types';

interface SoundRayProps {
  paths: SoundRayPath[];
  selectedChamberId: string | null;
  visible: boolean;
}

export function SoundRay({ paths, selectedChamberId, visible }: SoundRayProps) {
  const groupRef = useRef<THREE.Group>(null);

  const relevantPaths = useMemo(() => {
    if (!visible) return [];
    if (selectedChamberId) {
      return paths.filter(p =>
        p.reflectedChambers.length === 0 ||
        p.reflectedChambers.includes(selectedChamberId)
      );
    }
    return paths.filter(p => p.reflectedChambers.length === 0);
  }, [paths, selectedChamberId, visible]);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.children.forEach(child => {
        if (child instanceof THREE.Line) {
          const mat = child.material as any;
          if (mat.dashOffset !== undefined) {
            mat.dashOffset -= delta * 3;
            mat.needsUpdate = true;
          }
        }
      });
    }
  });

  if (!visible || relevantPaths.length === 0) return null;

  return (
    <group ref={groupRef}>
      {relevantPaths.map((path, pathIdx) => {
        const points = path.points.map(p => [p.x - 5, p.y, p.z - 5] as [number, number, number]);

        const isDirect = path.reflectedChambers.length === 0;
        const isRelevant = selectedChamberId && path.reflectedChambers.includes(selectedChamberId);

        const color = isDirect ? '#4a90d9' : isRelevant ? '#d4762a' : '#4a90d9';
        const opacity = isDirect ? 0.4 : isRelevant ? 0.9 : 0.2;

        return (
          <Line
            key={pathIdx}
            points={points}
            color={color}
            lineWidth={2}
            dashed
            dashSize={0.2}
            gapSize={0.1}
            transparent
            opacity={opacity}
          />
        );
      })}
    </group>
  );
}
