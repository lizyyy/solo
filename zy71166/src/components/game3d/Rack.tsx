import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Mesh } from 'three';
import type { Rack as RackType } from '../../engine/types';
import { tempToColor } from '../../utils/temperature';
import { useUISTore } from '../../store/useUISTore';

interface RackProps {
  rack: RackType;
  isSelected: boolean;
  onClick: () => void;
}

export function Rack({ rack, isSelected, onClick }: RackProps) {
  const meshRef = useRef<Mesh>(null);
  const { cameraView } = useUISTore();

  const height = 2;
  const width = 0.9;
  const depth = 1.2;

  const tempColor = useMemo(() => tempToColor(rack.temperature), [rack.temperature]);

  useFrame((state, delta) => {
    if (!meshRef.current) return;
    if (isSelected) {
      meshRef.current.position.y = 0.05 * Math.sin(state.clock.elapsedTime * 3);
    } else {
      meshRef.current.position.y = 0;
    }
  });

  const statusIndicatorColor = rack.status === 'normal' ? '#22c55e'
    : rack.status === 'warning' ? '#eab308'
    : rack.status === 'danger' ? '#f97316'
    : '#ef4444';

  return (
    <group position={[rack.position.x, height / 2, rack.position.z]}>
      <mesh
        ref={meshRef}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
      >
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color="#1e293b"
          metalness={0.3}
          roughness={0.7}
        />
      </mesh>

      <mesh position={[0, 0, depth / 2 + 0.01]}>
        <boxGeometry args={[width * 0.95, height * 0.95, 0.02]} />
        <meshStandardMaterial
          color={tempColor}
          emissive={tempColor}
          emissiveIntensity={0.3}
          transparent
          opacity={0.7}
        />
      </mesh>

      <mesh position={[0, height / 2 - 0.1, depth / 2 + 0.02]}>
        <boxGeometry args={[0.15, 0.15, 0.03]} />
        <meshStandardMaterial
          color={statusIndicatorColor}
          emissive={statusIndicatorColor}
          emissiveIntensity={0.8}
        />
      </mesh>

      {Array.from({ length: 6 }).map((_, i) => (
        <mesh
          key={i}
          position={[0, -height / 2 + 0.3 + i * 0.3, depth / 2 + 0.015]}
        >
          <boxGeometry args={[width * 0.85, 0.02, 0.01]} />
          <meshStandardMaterial color="#475569" />
        </mesh>
      ))}

      {isSelected && (
        <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.7, 0.9, 32]} />
          <meshBasicMaterial
            color="#0ea5e9"
            transparent
            opacity={0.6}
            side={2}
          />
        </mesh>
      )}
    </group>
  );
}
