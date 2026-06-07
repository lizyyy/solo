import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import type { PointData } from '../../types';
import { statusColors } from '../../utils/helpers';
import { markPointClicked } from '../../utils/clickGuard';
import * as THREE from 'three';

interface PointMarkerProps {
  point: PointData;
  isSelected: boolean;
  onClick: () => void;
  visible: boolean;
}

export const PointMarker: React.FC<PointMarkerProps> = ({ point, isSelected, onClick, visible }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    if (meshRef.current) {
      const pulse = 1 + Math.sin(timeRef.current * 2) * 0.05;
      const baseScale = isSelected ? 1.3 : hovered ? 1.15 : 1;
      meshRef.current.scale.setScalar(baseScale * pulse);
    }
    if (glowRef.current && point.status !== 'normal') {
      const glowPulse = 1 + Math.sin(timeRef.current * 3) * 0.2;
      glowRef.current.scale.setScalar(glowPulse);
      const mat = glowRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.3 + Math.sin(timeRef.current * 3) * 0.15;
    }
  });

  if (!visible) return null;

  const color = statusColors[point.status];
  const hasConflict = point.conflict && !point.conflict.resolved;

  return (
    <group position={[point.position.x, point.position.y, point.position.z]}>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          markPointClicked();
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
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 1.2 : 0.6}
          transparent
          opacity={0.9}
        />
      </mesh>

      {point.status !== 'normal' && (
        <mesh ref={glowRef}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {hasConflict && (
        <mesh position={[0.25, 0.25, 0]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshStandardMaterial color="#F59E0B" emissive="#F59E0B" emissiveIntensity={0.8} />
        </mesh>
      )}

      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.4, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};
