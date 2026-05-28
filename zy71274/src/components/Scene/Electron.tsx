import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { EnergyLevel as EnergyLevelType } from '@/types';

interface ElectronProps {
  level: EnergyLevelType;
  isActive: boolean;
}

export function Electron({ level, isActive }: ElectronProps) {
  const groupRef = useRef<THREE.Group>(null);
  const particleRef = useRef<THREE.Points>(null);

  const particles = useMemo(() => {
    const count = 8;
    const positions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      positions[i * 3] = Math.cos(angle) * 1.5;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = Math.sin(angle) * 1.5;
    }
    
    return positions;
  }, []);

  useFrame(({ clock }) => {
    const elapsed = clock.getElapsedTime();
    if (groupRef.current) {
      groupRef.current.position.y = level.height + 0.2 + Math.sin(elapsed * 0.5 + level.n) * 0.05;
      groupRef.current.rotation.y = elapsed * (1 + level.n * 0.2);
    }
  });

  if (!isActive) return null;

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color="#06b6d4"
          emissive="#06b6d4"
          emissiveIntensity={2}
        />
      </mesh>
      <points ref={particleRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={8}
            array={particles}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.05}
          color="#06b6d4"
          transparent
          opacity={0.6}
          sizeAttenuation
        />
      </points>
    </group>
  );
}
