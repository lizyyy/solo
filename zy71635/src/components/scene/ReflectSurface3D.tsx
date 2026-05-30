import { useRef } from 'react';
import * as THREE from 'three';
import type { ReflectSurface } from '@/utils/types';
import { useHallStore } from '@/store/useHallStore';

interface ReflectSurface3DProps {
  surface: ReflectSurface;
  showDiff?: boolean;
  diffColor?: string;
}

export function ReflectSurface3D({ surface, showDiff = false, diffColor }: ReflectSurface3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const setFocusTarget = useHallStore((s) => s.setFocusTarget);
  const selection = useHallStore((s) => s.selection);

  const isSelected = selection.type === 'surface' && selection.id === surface.id;

  const handleClick = (e: any) => {
    e.stopPropagation();
    setFocusTarget({ type: 'surface', id: surface.id });
  };

  const angleRad = (surface.angle * Math.PI) / 180;

  return (
    <group position={surface.position}>
      <mesh
        ref={meshRef}
        rotation={[angleRad, 0, 0]}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <planeGeometry args={surface.size} />
        <meshStandardMaterial
          color={isSelected ? '#f59e0b' : showDiff && diffColor ? diffColor : '#60a5fa'}
          transparent
          opacity={isSelected ? 0.9 : 0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      {(isSelected || showDiff) && (
        <lineSegments>
          <edgesGeometry args={[new THREE.PlaneGeometry(surface.size[0], surface.size[1])]} />
          <lineBasicMaterial color={showDiff && diffColor ? diffColor : '#fbbf24'} linewidth={2} />
        </lineSegments>
      )}
    </group>
  );
}
