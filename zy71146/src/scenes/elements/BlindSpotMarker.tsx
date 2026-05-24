import { useRef, useState } from 'react';
import { Mesh } from 'three';
import { useFrame } from '@react-three/fiber';
import { Text } from '@react-three/drei';
import { BlindSpot } from '@/types';
import { useAnalysisStore } from '@/store/analysisStore';

interface BlindSpotMarkerProps {
  data: BlindSpot;
  onClick?: () => void;
}

const severityColors: Record<string, string> = {
  low: '#4caf50',
  medium: '#ff9800',
  high: '#f44336',
};

const typeLabels: Record<string, string> = {
  occlusion: '遮挡',
  missing_sign: '缺导视',
  temporary_barrier: '围挡',
};

export function BlindSpotMarker({ data, onClick }: BlindSpotMarkerProps) {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const activeBlindSpot = useAnalysisStore(state => state.activeBlindSpot);
  const isActive = activeBlindSpot === data.id;

  useFrame(({ clock }) => {
    if (meshRef.current) {
      const elapsed = clock.getElapsedTime();
      meshRef.current.position.y = data.position[1] + Math.sin(elapsed * 3) * 0.2;
      meshRef.current.rotation.y = elapsed * 0.5;
    }
  });

  const color = severityColors[data.severity];

  return (
    <group position={[data.position[0], data.position[1], data.position[2]]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <coneGeometry args={[0.4, 0.8, 6]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={hovered || isActive ? 1 : 0.8}
        />
      </mesh>

      <mesh position={[0, 1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.3, 0.5, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.5}
          side={2}
        />
      </mesh>

      <Text
        position={[0, 2, 0]}
        fontSize={0.4}
        color={color}
        anchorX="center"
        anchorY="middle"
        fontWeight="bold"
      >
        {typeLabels[data.type]}
      </Text>

      {isActive && (
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.8, 1.2, 32]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.3}
          />
        </mesh>
      )}
    </group>
  );
}
