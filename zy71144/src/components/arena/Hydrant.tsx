import { useState } from 'react';
import { Html } from '@react-three/drei';
import type { Hydrant as HydrantType } from '../../types';

interface HydrantProps {
  hydrant: HydrantType;
  onClick?: (position: HydrantType['position']) => void;
  selected?: boolean;
  visible?: boolean;
}

export function Hydrant({
  hydrant,
  onClick,
  selected = false,
  visible = true,
}: HydrantProps) {
  const [hovered, setHovered] = useState(false);

  if (!visible) return null;

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onClick?.(hydrant.position);
  };

  return (
    <group position={[hydrant.position.x, hydrant.position.y, hydrant.position.z]}>
      <mesh
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
        castShadow
      >
        <cylinderGeometry args={[0.3, 0.35, 0.8, 16]} />
        <meshStandardMaterial
          color={selected ? '#ef4444' : '#dc2626'}
          emissive={selected || hovered ? '#ef4444' : '#991b1b'}
          emissiveIntensity={selected ? 0.5 : hovered ? 0.3 : 0.1}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>

      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.38, 0.1, 16]} />
        <meshStandardMaterial color="#991b1b" metalness={0.4} roughness={0.4} />
      </mesh>

      <mesh position={[0, 0.6, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.3, 0.15, 16]} />
        <meshStandardMaterial color="#7f1d1d" metalness={0.5} roughness={0.3} />
      </mesh>

      <mesh position={[0.35, 0.3, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.3, 8]} />
        <meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.3} />
      </mesh>

      {(hovered || selected) && (
        <Html position={[0, 1.5, 0]} center distanceFactor={10}>
          <div className="bg-slate-900/95 text-white px-3 py-2 rounded-lg text-sm whitespace-nowrap border border-red-500/50 shadow-lg">
            <div className="font-semibold text-red-400">{hydrant.name}</div>
            <div className="text-xs text-slate-300">压力: {hydrant.pressure} MPa</div>
          </div>
        </Html>
      )}
    </group>
  );
}
