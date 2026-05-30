import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { CollisionEvent } from '../../types';
import * as THREE from 'three';

interface CollisionMarkerProps {
  collision: CollisionEvent;
  visible: boolean;
}

export const CollisionMarker: React.FC<CollisionMarkerProps> = ({
  collision,
  visible
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const pulseRef = useRef(0);

  useFrame((_, delta) => {
    if (groupRef.current && visible) {
      pulseRef.current += delta * 2;
      const scale = 1 + Math.sin(pulseRef.current) * 0.2;
      groupRef.current.scale.setScalar(scale);
    }
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} position={[collision.position.x, 0.15, collision.position.y]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.1, 0.15, 32]} />
        <meshBasicMaterial color="#ff4444" transparent opacity={0.8} side={2} />
      </mesh>
      
      <mesh position={[0, 0.3, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color="#ff4444" />
      </mesh>

      <mesh position={[0, 0.5, 0]}>
        <coneGeometry args={[0.05, 0.15, 8]} />
        <meshBasicMaterial color="#ff4444" />
      </mesh>
    </group>
  );
};
