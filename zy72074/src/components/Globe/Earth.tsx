import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { EARTH_RADIUS } from '../../utils/coordinate';

interface EarthProps {
  autoRotate?: boolean;
  rotateSpeed?: number;
}

export function Earth({ autoRotate = true, rotateSpeed = 0.1 }: EarthProps) {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (earthRef.current && autoRotate) {
      earthRef.current.rotation.y += delta * rotateSpeed;
    }
    if (cloudsRef.current && autoRotate) {
      cloudsRef.current.rotation.y += delta * rotateSpeed * 1.2;
    }
  });

  const earthTextureUrl = "https://unpkg.com/three-globe@2.24.13/example/img/earth-blue-marble.jpg";

  return (
    <group>
      <mesh ref={earthRef}>
        <sphereGeometry args={[EARTH_RADIUS, 64, 64]} />
        <meshStandardMaterial
          map={new THREE.TextureLoader().load(earthTextureUrl)}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>
      
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[EARTH_RADIUS * 1.005, 64, 64]} />
        <meshStandardMaterial
          color="#ffffff"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
