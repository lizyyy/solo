import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SunPosition } from '../../types';

interface SunProps {
  sunPosition: SunPosition;
  lightColor: string;
}

export default function Sun({ sunPosition, lightColor }: SunProps) {
  const sunRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const lightRef = useRef<THREE.DirectionalLight>(null);

  const sunGeometry = useMemo(() => new THREE.SphereGeometry(5, 32, 32), []);
  const glowGeometry = useMemo(() => new THREE.SphereGeometry(8, 32, 32), []);

  useFrame((state) => {
    if (glowRef.current) {
      const material = glowRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.2 + Math.sin(state.clock.elapsedTime * 2) * 0.1;
    }
  });

  if (sunPosition.altitude <= 0) {
    return null;
  }

  return (
    <group position={sunPosition.position}>
      <mesh ref={sunRef} geometry={sunGeometry}>
        <meshBasicMaterial color={lightColor} />
      </mesh>
      
      <mesh ref={glowRef} geometry={glowGeometry}>
        <meshBasicMaterial 
          color={lightColor} 
          transparent 
          opacity={0.3} 
          side={THREE.BackSide}
        />
      </mesh>

      <directionalLight
        ref={lightRef}
        color={lightColor}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={300}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.0001}
      />

      <pointLight color={lightColor} intensity={0.5} distance={200} />
    </group>
  );
}
