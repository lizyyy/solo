import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { ErrorItem } from '../../types';
import * as THREE from 'three';

interface ErrorMarkerProps {
  error: ErrorItem;
  onClick: () => void;
}

export const ErrorMarker: React.FC<ErrorMarkerProps> = ({ error, onClick }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.1);
    }
  });

  if (!error.position) return null;

  const color = error.severity === 'error' ? '#F53F3F' : '#FF7D00';

  return (
    <group
      position={[error.position.x, error.position.y + 0.5, error.position.z]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh ref={meshRef}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>

      <mesh position={[0, 0.05, 0]}>
        <torusGeometry args={[0.2, 0.02, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>

      <mesh position={[0, 0.05, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.02, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} />
      </mesh>
    </group>
  );
};
