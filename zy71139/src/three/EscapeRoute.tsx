import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EscapeRoute as EscapeRouteType } from '../types';

interface EscapeRouteProps {
  route: EscapeRouteType;
}

export const EscapeRoute: React.FC<EscapeRouteProps> = ({ route }) => {
  const glowRef = useRef<THREE.Mesh>(null);
  const signRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      const material = glowRef.current.material as THREE.MeshBasicMaterial;
      const pulse = 0.6 + Math.sin(clock.elapsedTime * 2) * 0.4;
      material.opacity = route.isBlocked ? 0.2 : pulse;
      material.color.set(route.isBlocked ? '#ef4444' : '#22c55e');
    }
    if (signRef.current) {
      signRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.5) * 0.1;
    }
  });

  return (
    <group position={[route.position.x, route.position.y, route.position.z]}>
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[3, 5, 0.5]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.5} roughness={0.5} />
      </mesh>

      <mesh position={[0, 2.5, 0.3]}>
        <boxGeometry args={[2.6, 4.6, 0.1]} />
        <meshStandardMaterial 
          color={route.isBlocked ? '#4a1a1a' : '#1a3a1a'} 
          emissive={route.isBlocked ? '#ef4444' : '#22c55e'}
          emissiveIntensity={route.isBlocked ? 0.3 : 0.5}
        />
      </mesh>

      <mesh ref={glowRef} position={[0, 2.5, 0.5]}>
        <boxGeometry args={[3.2, 5.2, 0.1]} />
        <meshBasicMaterial 
          color={route.isBlocked ? '#ef4444' : '#22c55e'} 
          transparent 
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      <group ref={signRef} position={[0, 4.5, 0.8]}>
        <mesh>
          <boxGeometry args={[2, 1, 0.1]} />
          <meshBasicMaterial color="#1f2937" />
        </mesh>
        <mesh position={[0, 0, 0.06]}>
          <boxGeometry args={[1.8, 0.8, 0.01]} />
          <meshBasicMaterial color={route.isBlocked ? '#dc2626' : '#16a34a'} />
        </mesh>
        <mesh position={[0, 0, 0.1]}>
          <cylinderGeometry args={[0.15, 0.15, 0.02, 16]} />
          <meshBasicMaterial color="white" />
        </mesh>
      </group>

      {route.isBlocked && (
        <group position={[0, 5, 0]}>
          <mesh>
            <sphereGeometry args={[0.5, 16, 16]} />
            <meshBasicMaterial color="#ef4444" transparent opacity={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.01]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.6, 0.1, 0.02]} />
            <meshBasicMaterial color="white" />
          </mesh>
        </group>
      )}

      {[0, 1, 2].map((i) => (
        <mesh 
          key={`light-${i}`} 
          position={[0, 0.5 + i * 1.5, 0.6]}
        >
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial 
            color={route.isBlocked ? '#ef4444' : '#22c55e'} 
          />
        </mesh>
      ))}
    </group>
  );
};
