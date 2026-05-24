import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Fan as FanType } from '../types';

interface FanProps {
  fan: FanType;
  onClick?: () => void;
}

export const Fan: React.FC<FanProps> = ({ fan, onClick }) => {
  const bladesRef = useRef<THREE.Group>(null);
  const airFlowRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (bladesRef.current && fan.isOn) {
      const rotationSpeed = (fan.power / 100) * 15 * delta;
      const direction = fan.direction === 'forward' ? 1 : -1;
      bladesRef.current.rotation.x += rotationSpeed * direction;
    }
    
    if (airFlowRef.current) {
      const material = airFlowRef.current.material as THREE.MeshBasicMaterial;
      if (fan.isOn) {
        material.opacity = 0.3 + Math.sin(Date.now() * 0.005) * 0.1;
        material.visible = true;
      } else {
        material.visible = false;
      }
    }
  });

  const directionRotation = fan.direction === 'backward' ? Math.PI : 0;
  const baseColor = fan.isOn ? '#f97316' : '#6b7280';
  const glowIntensity = fan.isOn ? 1 : 0;

  return (
    <group position={[fan.position.x, fan.position.y, fan.position.z]} onClick={onClick}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[1.2, 1.2, 2, 16]} />
        <meshStandardMaterial 
          color={baseColor} 
          metalness={0.8} 
          roughness={0.3}
          emissive={fan.isOn ? '#f97316' : '#000000'}
          emissiveIntensity={glowIntensity * 0.2}
        />
      </mesh>

      <mesh position={[0, 0, 1.1]}>
        <cylinderGeometry args={[1, 1, 0.3, 16]} />
        <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0, -1.1]}>
        <cylinderGeometry args={[1, 1, 0.3, 16]} />
        <meshStandardMaterial color="#374151" metalness={0.9} roughness={0.2} />
      </mesh>

      <group ref={bladesRef} rotation={[0, 0, directionRotation]}>
        {[0, 1, 2, 3].map((i) => (
          <mesh 
            key={i} 
            position={[0, 0, 0]} 
            rotation={[0, 0, (i * Math.PI) / 2]}
          >
            <boxGeometry args={[0.1, 1.4, 0.08]} />
            <meshStandardMaterial 
              color="#e5e7eb" 
              metalness={0.5} 
              roughness={0.4}
            />
          </mesh>
        ))}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.25, 16, 16]} />
          <meshStandardMaterial 
            color="#1f2937" 
            metalness={0.9} 
            roughness={0.2}
          />
        </mesh>
      </group>

      <mesh 
        ref={airFlowRef}
        position={[fan.direction === 'forward' ? 8 : -8, 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <coneGeometry args={[1.5, 12, 8, 1, true]} />
        <meshBasicMaterial 
          color="#60a5fa" 
          transparent 
          opacity={0}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh position={[0, 2, 0]}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial color={fan.isOn ? '#22c55e' : '#6b7280'} />
      </mesh>

      <mesh position={[0, -2, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.3, 0.5, 0.8, 8]} />
        <meshStandardMaterial color="#4b5563" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
};
