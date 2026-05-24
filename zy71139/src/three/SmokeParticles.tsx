import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { SmokeParticle } from '../types';

interface SmokeParticlesProps {
  particles: SmokeParticle[];
}

export const SmokeParticles: React.FC<SmokeParticlesProps> = ({ particles }) => {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = particles.length;

  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);

    particles.forEach((particle, i) => {
      positions[i * 3] = particle.position.x;
      positions[i * 3 + 1] = particle.position.y;
      positions[i * 3 + 2] = particle.position.z;

      const lifeFactor = particle.life;
      const densityFactor = particle.density;
      
      const r = 0.3 + (1 - lifeFactor) * 0.2;
      const g = 0.25 + (1 - lifeFactor) * 0.1;
      const b = 0.2;
      
      colors[i * 3] = r * densityFactor;
      colors[i * 3 + 1] = g * densityFactor;
      colors[i * 3 + 2] = b * densityFactor;

      sizes[i] = 0.3 + lifeFactor * 0.5;
    });

    return { positions, colors, sizes };
  }, [particles]);

  useFrame(() => {
    if (pointsRef.current && particleCount > 0) {
      const geometry = pointsRef.current.geometry;
      const positionAttribute = geometry.attributes.position;
      const colorAttribute = geometry.attributes.color;

      particles.forEach((particle, i) => {
        if (i < positionAttribute.count) {
          positionAttribute.setX(i, particle.position.x);
          positionAttribute.setY(i, particle.position.y);
          positionAttribute.setZ(i, particle.position.z);

          const lifeFactor = particle.life;
          const densityFactor = particle.density;
          
          const r = 0.3 + (1 - lifeFactor) * 0.2;
          const g = 0.25 + (1 - lifeFactor) * 0.1;
          const b = 0.2;
          
          colorAttribute.setX(i, r * densityFactor);
          colorAttribute.setY(i, g * densityFactor);
          colorAttribute.setZ(i, b * densityFactor);
        }
      });

      positionAttribute.needsUpdate = true;
      colorAttribute.needsUpdate = true;
    }
  });

  if (particleCount === 0) return null;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particleCount}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.8}
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};
