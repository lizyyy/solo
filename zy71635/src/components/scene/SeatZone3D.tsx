import { useRef } from 'react';
import * as THREE from 'three';
import type { SeatZone } from '@/utils/types';
import { useHallStore } from '@/store/useHallStore';

interface SeatZone3DProps {
  zone: SeatZone;
}

const zoneColors: Record<string, string> = {
  orchestra: '#22c55e',
  mezzanine: '#3b82f6',
  balcony: '#a855f7',
  vip: '#f59e0b',
};

export function SeatZone3D({ zone }: SeatZone3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const setFocusTarget = useHallStore((s) => s.setFocusTarget);
  const selection = useHallStore((s) => s.selection);

  const isSelected = selection.type === 'zone' && selection.id === zone.id;

  const handleClick = (e: any) => {
    e.stopPropagation();
    setFocusTarget({ type: 'zone', id: zone.id });
  };

  const width = zone.bounds.max[0] - zone.bounds.min[0];
  const height = zone.bounds.max[1] - zone.bounds.min[1];
  const depth = zone.bounds.max[2] - zone.bounds.min[2];
  const centerX = (zone.bounds.min[0] + zone.bounds.max[0]) / 2;
  const centerY = (zone.bounds.min[1] + zone.bounds.max[1]) / 2;
  const centerZ = (zone.bounds.min[2] + zone.bounds.max[2]) / 2;

  const color = zoneColors[zone.zoneType] || '#6b7280';

  return (
    <mesh
      ref={meshRef}
      position={[centerX, centerY, centerZ]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'auto';
      }}
    >
      <boxGeometry args={[width, height, depth]} />
      <meshStandardMaterial
        color={isSelected ? '#f59e0b' : color}
        transparent
        opacity={isSelected ? 0.6 : 0.3}
      />
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
        <lineBasicMaterial color={isSelected ? '#fbbf24' : color} linewidth={1} />
      </lineSegments>
    </mesh>
  );
}
