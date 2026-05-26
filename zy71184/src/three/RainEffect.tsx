import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CONFIG } from '../engine/config';
import { RainEvent } from '../engine/types';

interface RainEffectProps {
  currentRain: RainEvent | null;
}

export function RainEffect({ currentRain }: RainEffectProps) {
  const rainRef = useRef<THREE.Points>(null);
  const particleCount = 500;

  const { positions, velocities, intensities } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const vel = new Float32Array(particleCount);
    const inten = new Float32Array(particleCount);

    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * CONFIG.GRID_SIZE * CONFIG.CELL_SIZE;
      pos[i * 3 + 1] = Math.random() * 50;
      pos[i * 3 + 2] = (Math.random() - 0.5) * CONFIG.GRID_SIZE * CONFIG.CELL_SIZE;
      vel[i] = 0.3 + Math.random() * 0.2;
      inten[i] = Math.random();
    }

    return { positions: pos, velocities: vel, intensities: inten };
  }, []);

  useFrame(() => {
    if (!rainRef.current || !currentRain) return;

    const rainIntensity = CONFIG.RAIN_INTENSITY_MAP[currentRain.intensity].rainfall;
    const speedMultiplier = 1 + rainIntensity * 0.1;

    const posArray = rainRef.current.geometry.attributes.position.array as Float32Array;
    
    for (let i = 0; i < particleCount; i++) {
      if (intensities[i] < rainIntensity / 15) {
        posArray[i * 3 + 1] -= velocities[i] * speedMultiplier;
        
        if (posArray[i * 3 + 1] < 0) {
          posArray[i * 3 + 1] = 50;
          posArray[i * 3] = (Math.random() - 0.5) * CONFIG.GRID_SIZE * CONFIG.CELL_SIZE;
          posArray[i * 3 + 2] = (Math.random() - 0.5) * CONFIG.GRID_SIZE * CONFIG.CELL_SIZE;
        }
      }
    }
    
    rainRef.current.geometry.attributes.position.needsUpdate = true;
  });

  useEffect(() => {
    if (rainRef.current) {
      rainRef.current.visible = !!currentRain;
    }
  }, [currentRain]);

  return (
    <points ref={rainRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        color="#87CEEB"
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  );
}
