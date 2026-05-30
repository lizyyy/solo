import { useRef } from 'react';
import * as THREE from 'three';
import type { SoundSource } from '@/utils/types';
import { useHallStore } from '@/store/useHallStore';

interface SoundSource3DProps {
  source: SoundSource;
}

export function SoundSource3D({ source }: SoundSource3DProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const setFocusTarget = useHallStore((s) => s.setFocusTarget);
  const selection = useHallStore((s) => s.selection);

  const isSelected = selection.type === 'source' && selection.id === source.id;

  const handleClick = (e: any) => {
    e.stopPropagation();
    setFocusTarget({ type: 'source', id: source.id });
  };

  return (
    <group position={source.position}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial
          color={isSelected ? '#f59e0b' : '#ef4444'}
          emissive={isSelected ? '#f59e0b' : '#ef4444'}
          emissiveIntensity={0.5}
        />
      </mesh>
      <pointLight color="#ff6b6b" intensity={2} distance={10} />
    </group>
  );
}
