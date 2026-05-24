import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SmokeSource } from '../types';

interface FireSourceProps {
  source: SmokeSource;
}

export const FireSource: React.FC<FireSourceProps> = ({ source }) => {
  const fireRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  useFrame(({ clock }) => {
    if (fireRef.current && source.active) {
      fireRef.current.scale.setScalar(1 + Math.sin(clock.elapsedTime * 5) * 0.1);
      fireRef.current.position.y = source.position.y + Math.sin(clock.elapsedTime * 3) * 0.1;
    }
    
    if (particlesRef.current && source.active) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i + 1] += 0.02;
        if (positions[i + 1] > source.position.y + 3) {
          positions[i] = source.position.x + (Math.random() - 0.5) * 1.5;
          positions[i + 1] = source.position.y;
          positions[i + 2] = source.position.z + (Math.random() - 0.5) * 1.5;
        }
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  if (!source.active) return null;

  const particleCount = 50;
  const positions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = source.position.x + (Math.random() - 0.5) * 1.5;
    positions[i * 3 + 1] = source.position.y + Math.random() * 2;
    positions[i * 3 + 2] = source.position.z + (Math.random() - 0.5) * 1.5;
  }

  return (
    <group>
      <group ref={fireRef} position={[source.position.x, source.position.y, source.position.z]}>
        <mesh>
          <coneGeometry args={[0.8, 2, 8]} />
          <meshBasicMaterial 
            color="#ff6b35" 
            transparent 
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
        
        <mesh position={[0, 0.3, 0]}>
          <coneGeometry args={[0.5, 1.5, 8]} />
          <meshBasicMaterial 
            color="#ffaa00" 
            transparent 
            opacity={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
        
        <mesh position={[0, 0.5, 0]}>
          <coneGeometry args={[0.3, 1, 8]} />
          <meshBasicMaterial 
            color="#ffff88" 
            transparent 
            opacity={1}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      <pointLight 
        position={[source.position.x, source.position.y + 1, source.position.z]}
        intensity={2}
        distance={15}
        color="#ff6b35"
        castShadow
      />

      <mesh position={[source.position.x, source.position.y + 0.1, source.position.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 32]} />
        <meshBasicMaterial 
          color="#ff4400" 
          transparent 
          opacity={0.3}
        />
      </mesh>

      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particleCount}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.2}
          color="#ffaa00"
          transparent
          opacity={0.7}
          sizeAttenuation
        />
      </points>
    </group>
  );
};
