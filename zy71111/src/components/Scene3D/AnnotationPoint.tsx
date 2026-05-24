
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CrackLevel, RecheckStatus } from '../../types';

interface AnnotationPointProps {
  position: [number, number, number];
  crackLevel: CrackLevel;
  recheckStatus: RecheckStatus;
  isSelected: boolean;
  onClick: () => void;
}

const levelColors: Record<CrackLevel, string> = {
  [CrackLevel.LIGHT]: '#22c55e',
  [CrackLevel.MODERATE]: '#f97316',
  [CrackLevel.SEVERE]: '#ef4444',
};

const statusColors: Record<RecheckStatus, string> = {
  [RecheckStatus.PENDING]: '#fbbf24',
  [RecheckStatus.VERIFIED]: '#06b6d4',
  [RecheckStatus.RESOLVED]: '#22c55e',
};

export function AnnotationPoint({
  position,
  crackLevel,
  recheckStatus,
  isSelected,
  onClick,
}: AnnotationPointProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 2;
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.1;
      ringRef.current.scale.setScalar(isSelected ? scale * 1.5 : scale);
    }
    if (meshRef.current) {
      const targetScale = isSelected || hovered ? 1.3 : 1;
      meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1);
    }
  });

  const baseColor = levelColors[crackLevel];
  const ringColor = statusColors[recheckStatus];

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          setHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={isSelected ? 0.8 : 0.3}
        />
      </mesh>

      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.02, 8, 32]} />
        <meshBasicMaterial color={ringColor} transparent opacity={0.8} />
      </mesh>

      <pointLight color={baseColor} intensity={isSelected ? 2 : 0.5} distance={2} />
    </group>
  );
}
