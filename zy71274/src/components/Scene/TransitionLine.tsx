import { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Transition as TransitionType, EnergyLevel as EnergyLevelType } from '@/types';

interface TransitionLineProps {
  transition: TransitionType;
  fromLevel: EnergyLevelType | undefined;
  toLevel: EnergyLevelType | undefined;
  isActive: boolean;
}

export function TransitionLine({ transition, fromLevel, toLevel, isActive }: TransitionLineProps) {
  const lineRef = useRef<THREE.Line>(null);
  const [progress, setProgress] = useState(0);

  const points = useMemo(() => {
    if (!fromLevel || !toLevel) return null;
    
    const positions: THREE.Vector3[] = [];
    const steps = 20;
    
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const fromY = fromLevel.height;
      const toY = toLevel.height;
      const x = Math.sin(t * Math.PI) * 1.5;
      const y = fromY + (toY - fromY) * t;
      const z = 0;
      positions.push(new THREE.Vector3(x, y, z));
    }
    
    return positions;
  }, [fromLevel, toLevel]);

  useFrame((_, delta) => {
    if (isActive && lineRef.current) {
      setProgress(prev => {
        const newProgress = prev + delta * 0.5;
        return newProgress > 1 ? 0 : newProgress;
      });
    }
  });

  if (!points || !fromLevel || !toLevel) return null;

  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const color = transition.probability > 0.5 ? '#22c55e' : '#eab308';

  return (
    <group>
      <lineSegments ref={lineRef as any}>
        <bufferGeometry attach="geometry" {...geometry} />
        <lineBasicMaterial
          attach="material"
          color={color}
          transparent
          opacity={isActive ? 0.9 : 0.2}
        />
      </lineSegments>
      
      {isActive && (
        <mesh position={points[Math.floor(progress * (points.length - 1))]}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
    </group>
  );
}
