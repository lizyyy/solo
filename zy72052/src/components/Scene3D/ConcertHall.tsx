import { useMemo } from 'react';

export function ConcertHall() {
  const walls = useMemo(() => {
    const wallData = [
      { pos: [0, 2.5, -5] as [number, number, number], scale: [10, 5, 0.05] as [number, number, number] },
      { pos: [0, 2.5, 5] as [number, number, number], scale: [10, 5, 0.05] as [number, number, number] },
      { pos: [-5, 2.5, 0] as [number, number, number], scale: [0.05, 5, 10] as [number, number, number] },
      { pos: [5, 2.5, 0] as [number, number, number], scale: [0.05, 5, 10] as [number, number, number] },
      { pos: [0, 0, 0] as [number, number, number], scale: [10, 0.05, 10] as [number, number, number] },
      { pos: [0, 5, 0] as [number, number, number], scale: [10, 0.05, 10] as [number, number, number] },
    ];
    return wallData;
  }, []);

  return (
    <group>
      {walls.map((wall, i) => (
        <mesh key={i} position={wall.pos}>
          <boxGeometry args={wall.scale} />
          <meshStandardMaterial
            color="#0d1b2a"
            transparent
            opacity={i < 4 ? 0.15 : 0.08}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      <gridHelper args={[10, 20, '#1a2942', '#1a2942']} position={[0, 0.01, 0]} />

      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={`seat-${i}`} position={[-2 + i, 0.25, 2 + i * 0.8]}>
          <boxGeometry args={[0.4, 0.3, 0.4]} />
          <meshStandardMaterial color="#1a1a2e" transparent opacity={0.3} />
        </mesh>
      ))}
    </group>
  );
}

import * as THREE from 'three';
