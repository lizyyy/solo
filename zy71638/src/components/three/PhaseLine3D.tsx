import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { PhaseRelation, Microphone } from '@/types';
import { getPhaseColor } from '@/utils/acousticMath';

interface PhaseLine3DProps {
  relation: PhaseRelation;
  mic1: Microphone;
  mic2: Microphone;
}

export function PhaseLine3D({ relation, mic1, mic2 }: PhaseLine3DProps) {
  const points = useMemo(() => [
    new THREE.Vector3(mic1.position.x, mic1.position.y, mic1.position.z),
    new THREE.Vector3(mic2.position.x, mic2.position.y, mic2.position.z),
  ], [mic1.position, mic2.position]);
  
  const color = getPhaseColor(relation.phaseDiff);
  const opacity = relation.isCoherent ? 0.4 : 0.7;
  const lineWidth = relation.isCoherent ? 1 : 2;
  
  return (
    <Line
      points={points}
      color={color}
      transparent
      opacity={opacity}
      lineWidth={lineWidth}
    />
  );
}

export function PhaseLines() {
  return null;
}
