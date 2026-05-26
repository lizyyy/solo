import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface RainEffectProps {
  intensity: number;
  width: number;
  height: number;
}

export function RainEffect({ intensity, width, height }: RainEffectProps) {
  const rainRef = useRef<THREE.Points>(null);
  const count = Math.floor((intensity / 100) * 2000);

  const [positions, velocities] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * width;
      pos[i * 3 + 1] = Math.random() * 10 + 2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * height;
      vel[i] = 0.1 + Math.random() * 0.2;
    }

    return [pos, vel];
  }, [count, width, height]);

  useFrame(() => {
    if (!rainRef.current || count === 0) return;

    const positions = rainRef.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < count; i++) {
      positions[i * 3 + 1] -= velocities[i];

      if (positions[i * 3 + 1] < 0) {
        positions[i * 3 + 1] = 10 + Math.random() * 2;
        positions[i * 3] = (Math.random() - 0.5) * width;
        positions[i * 3 + 2] = (Math.random() - 0.5) * height;
      }
    }

    rainRef.current.geometry.attributes.position.needsUpdate = true;
  });

  if (count === 0) return null;

  return (
    <points ref={rainRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#AADDFF"
        size={0.05}
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}
