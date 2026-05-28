import { useMemo } from 'react';
import * as THREE from 'three';
import type { Zone } from '../types';

interface FloorGridProps {
  floorLevel: number;
  floorZ: number;
  width: number;
  depth: number;
  zones: Zone[];
  isSelected: boolean;
}

const ZONE_COLORS: Record<string, string> = {
  storage: '#3B82F6',
  picking: '#8B5CF6',
  charging: '#F59E0B',
  aisle: '#10B981',
};

export default function FloorGrid({ floorLevel, floorZ, width, depth, zones, isSelected }: FloorGridProps) {
  const gridHelper = useMemo(() => {
    const size = Math.max(width, depth);
    return { size, divisions: Math.ceil(size / 2) };
  }, [width, depth]);

  const zoneMeshes = useMemo(() => {
    return zones.map((zone) => {
      const b = zone.bounds;
      const centerX = (b.minX + b.maxX) / 2;
      const centerZ = (b.minY + b.maxY) / 2;
      const w = b.maxX - b.minX;
      const d = b.maxY - b.minY;
      const color = ZONE_COLORS[zone.type] ?? '#64748B';
      return { zone, centerX, centerZ, w, d, color };
    });
  }, [zones]);

  return (
    <group position={[0, floorZ, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          color="#0F172A"
          transparent
          opacity={isSelected ? 0.6 : 0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      <gridHelper
        args={[gridHelper.size, gridHelper.divisions, '#1E293B', '#1E293B']}
        rotation={[0, 0, 0]}
      />

      {zoneMeshes.map(({ zone, centerX, centerZ, w, d, color }) => (
        <mesh
          key={zone.id}
          position={[centerX, 0.01, centerZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[w, d]} />
          <meshStandardMaterial
            color={color}
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {zoneMeshes.map(({ zone, centerX, centerZ, w, d, color }) => (
        <lineSegments key={`border-${zone.id}`} position={[centerX, 0.02, centerZ]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(w, d)]} />
          <lineBasicMaterial color={color} transparent opacity={0.3} />
        </lineSegments>
      ))}
    </group>
  );
}
