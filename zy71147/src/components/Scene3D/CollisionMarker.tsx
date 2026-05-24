
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CollisionResult } from '../../types';

interface CollisionMarkerProps {
  collision: CollisionResult;
}

export const CollisionMarker: React.FC<CollisionMarkerProps> = ({ collision }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const color = collision.severity === 'error' ? '#F53F3F' : '#FF7D00';

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.y = (collision.position?.y || 5) + Math.sin(state.clock.elapsedTime * 2) * 0.5;
      meshRef.current.rotation.y = state.clock.elapsedTime;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = state.clock.elapsedTime * 2;
      ringRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 3) * 0.2);
    }
  });

  const pos = collision.position || { x: 0, y: 5, z: 0 };

  return (
    <group position={[pos.x, pos.y, pos.z]}>
      <mesh ref={meshRef}>
        <coneGeometry args={[0.8, 1.5, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.9}
        />
      </mesh>

      <mesh ref={ringRef} position={[0, 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.1, 8, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
        />
      </mesh>

      <mesh position={[0, 3.5, 0]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
        />
      </mesh>
    </group>
  );
};

