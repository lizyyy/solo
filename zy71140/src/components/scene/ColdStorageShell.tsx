import { useRef } from 'react';
import type { Group } from 'three';

interface ColdStorageShellProps {
  dimensions: { width: number; height: number; depth: number };
}

export function ColdStorageShell({ dimensions }: ColdStorageShellProps) {
  const groupRef = useRef<Group>(null);

  const { width, height, depth } = dimensions;
  const wallThickness = 0.2;

  return (
    <group ref={groupRef}>
      <mesh position={[0, height / 2, -depth / 2]}>
        <boxGeometry args={[width + wallThickness * 2, height, wallThickness]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.3} side={2} />
      </mesh>

      <mesh position={[0, height / 2, depth / 2]}>
        <boxGeometry args={[width + wallThickness * 2, height, wallThickness]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.15} side={2} />
      </mesh>

      <mesh position={[-width / 2, height / 2, 0]}>
        <boxGeometry args={[wallThickness, height, depth + wallThickness * 2]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.3} side={2} />
      </mesh>

      <mesh position={[width / 2, height / 2, 0]}>
        <boxGeometry args={[wallThickness, height, depth + wallThickness * 2]} />
        <meshStandardMaterial color="#1e293b" transparent opacity={0.3} side={2} />
      </mesh>

      <mesh position={[0, height, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#334155" transparent opacity={0.4} side={2} />
      </mesh>

      <mesh position={[0, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#0f172a" side={2} />
      </mesh>

      <gridHelper args={[Math.max(width, depth), 20, '#475569', '#334155']} position={[0, 0.02, 0]} />
    </group>
  );
}
