import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const Particles = () => {
  const particlesRef = useRef<THREE.Points>(null);
  const count = 500;

  const { positions, velocities, sizes } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      positions[i3] = (Math.random() - 0.5) * 60;
      positions[i3 + 1] = Math.random() * 30 - 5;
      positions[i3 + 2] = (Math.random() - 0.5) * 60;

      velocities[i3] = (Math.random() - 0.5) * 0.02;
      velocities[i3 + 1] = (Math.random() - 0.5) * 0.01;
      velocities[i3 + 2] = (Math.random() - 0.5) * 0.02;

      sizes[i] = Math.random() * 1.5 + 0.3;
    }

    return { positions, velocities, sizes };
  }, []);

  useFrame(() => {
    if (particlesRef.current) {
      const posAttr = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const posArray = posAttr.array as Float32Array;

      for (let i = 0; i < count; i++) {
        const i3 = i * 3;
        posArray[i3] += velocities[i3];
        posArray[i3 + 1] += velocities[i3 + 1];
        posArray[i3 + 2] += velocities[i3 + 2];

        if (posArray[i3] > 30 || posArray[i3] < -30) velocities[i3] *= -1;
        if (posArray[i3 + 1] > 25 || posArray[i3 + 1] < -5) velocities[i3 + 1] *= -1;
        if (posArray[i3 + 2] > 30 || posArray[i3 + 2] < -30) velocities[i3 + 2] *= -1;
      }

      posAttr.needsUpdate = true;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={count}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-size"
          count={count}
          array={sizes}
          itemSize={1}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#9D4EDD"
        size={0.15}
        transparent
        opacity={0.4}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
};

export default Particles;
