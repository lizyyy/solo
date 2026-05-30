import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface ProjectileProps {
  position: number;
  velocity: number;
  radius: number;
  isRunning: boolean;
  isHighlighted?: boolean;
  trackLength: number;
}

export function Projectile({ position, velocity, radius, isRunning, isHighlighted, trackLength }: ProjectileProps) {
  const groupRef = useRef<THREE.Group>(null);
  const trailRef = useRef<THREE.Points>(null);

  const trailPositions = useMemo(() => new Float32Array(100 * 3), []);
  const trailGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
    return geometry;
  }, [trailPositions]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.x = position - trackLength / 2;

      if (isRunning && velocity > 0) {
        groupRef.current.rotation.z += velocity * 0.01;
      }

      if (isHighlighted) {
        groupRef.current.scale.setScalar(1 + Math.sin(Date.now() * 0.01) * 0.05);
      } else {
        groupRef.current.scale.setScalar(1);
      }
    }

    if (trailRef.current && isRunning) {
      const positions = trailRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 99; i > 0; i--) {
        positions[i * 3] = positions[(i - 1) * 3];
        positions[i * 3 + 1] = positions[(i - 1) * 3 + 1];
        positions[i * 3 + 2] = positions[(i - 1) * 3 + 2];
      }
      positions[0] = position - trackLength / 2;
      positions[1] = 0;
      positions[2] = 0;
      trailRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <>
      <group ref={groupRef}>
        <mesh>
          <cylinderGeometry args={[radius, radius, radius * 3, 16]} />
          <meshStandardMaterial
            color="#ff6b35"
            metalness={0.7}
            roughness={0.3}
            emissive={isHighlighted ? '#ff3366' : '#ff6b35'}
            emissiveIntensity={isHighlighted ? 0.5 : 0.2}
          />
        </mesh>

        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius * 1.2, radius * 0.1, 8, 16]} />
          <meshBasicMaterial
            color="#00d4ff"
            transparent
            opacity={isRunning ? 0.8 : 0.3}
          />
        </mesh>
      </group>

      <points ref={trailRef} geometry={trailGeometry}>
        <pointsMaterial
          size={0.02}
          color="#00d4ff"
          transparent
          opacity={isRunning ? 0.6 : 0}
          sizeAttenuation
        />
      </points>
    </>
  );
}
