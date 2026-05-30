import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';

export default function Sun() {
  const sunRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (sunRef.current) {
      sunRef.current.rotation.y += 0.002;
    }
    if (glowRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 2) * 0.05;
      glowRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group position={[-15, 0, 0]}>
      <Sphere ref={sunRef} args={[3, 64, 64]}>
        <meshBasicMaterial color="#ff9500" />
      </Sphere>
      
      <Sphere ref={glowRef} args={[3.5, 32, 32]}>
        <meshBasicMaterial
          color="#ffaa00"
          transparent
          opacity={0.3}
          side={THREE.BackSide}
        />
      </Sphere>
      
      <Sphere args={[4.5, 32, 32]}>
        <meshBasicMaterial
          color="#ffcc00"
          transparent
          opacity={0.15}
          side={THREE.BackSide}
        />
      </Sphere>

      <pointLight position={[0, 0, 0]} intensity={2} color="#fff5e0" distance={100} />
      <pointLight position={[0, 0, 0]} intensity={1} color="#ff9500" distance={50} />
    </group>
  );
}
