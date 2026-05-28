import { useMemo } from 'react';
import * as THREE from 'three';
import { useThermalStore } from '@/store/useThermalStore';

export const HeatSinkMesh = () => {
  const { chipPackage } = useThermalStore();
  const heatSink = chipPackage.heatSinks[0];

  const fins = useMemo(() => {
    if (!heatSink) return [];
    const finCount = heatSink.finCount;
    const finWidth = 0.08;
    const finHeight = 0.8;
    const finDepth = 3.5;
    const spacing = 3.5 / finCount;
    const finPositions = [];
    
    for (let i = 0; i < finCount; i++) {
      const x = -1.75 + i * spacing + spacing / 2;
      finPositions.push({ x, y: 0.65, z: 0, width: finWidth, height: finHeight, depth: finDepth });
    }
    return finPositions;
  }, [heatSink]);

  if (!heatSink) return null;

  return (
    <group>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[4, 0.1, 4]} />
        <meshStandardMaterial color="#8b7355" metalness={0.9} roughness={0.2} />
      </mesh>

      {fins.map((fin, i) => (
        <mesh key={i} position={[fin.x, fin.y, fin.z]} castShadow>
          <boxGeometry args={[fin.width, fin.height, fin.depth]} />
          <meshStandardMaterial color="#a0522d" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}

      <mesh position={[0, 0.95, 0]}>
        <boxGeometry args={[4.2, 0.05, 3.7]} />
        <meshStandardMaterial color="#cd853f" metalness={0.9} roughness={0.2} transparent opacity={0.3} />
      </mesh>
    </group>
  );
};
