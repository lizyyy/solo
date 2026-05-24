import { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useSimulationStore } from '@/store/useSimulationStore';
import { createParticle, updateParticles, checkDriftAlerts } from '@/utils/physics';
import { COLORS, PESTICIDE_INFO } from '@/data/constants';
import * as THREE from 'three';

interface ParticleSystemProps {
  sprinklerPositions: [number, number, number][];
}

export function ParticleSystem({ sprinklerPositions }: ParticleSystemProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const particleIdRef = useRef(0);
  const lastEmitRef = useRef(0);

  const {
    params,
    isPlaying,
    currentScene,
    particles,
    updateParticles: updateStoreParticles,
    addAlert,
    setMaxDriftDistance,
    maxDriftDistance,
  } = useSimulationStore();

  const { windSpeed, windDirection, pesticideType, simulationSpeed, bufferThreshold } = params;
  const { adjacentFields, canal } = currentScene;

  const particleGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(2000 * 3);
    const colors = new Float32Array(2000 * 3);
    const sizes = new Float32Array(2000);

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

    return geometry;
  }, []);

  const pesticideColor = useMemo(() => {
    const info = PESTICIDE_INFO[pesticideType];
    const baseColor = new THREE.Color(COLORS.particle.split('(')[1].split(')')[0].replace(/rgba?/, ''));
    if (info.toxicity === 'high') {
      return new THREE.Color(0.9, 0.5, 0.5);
    } else if (info.toxicity === 'medium') {
      return new THREE.Color(0.9, 0.8, 0.5);
    }
    return new THREE.Color(0.7, 0.9, 0.7);
  }, [pesticideType]);

  useFrame((_, delta) => {
    if (!isPlaying || !pointsRef.current) return;

    lastEmitRef.current += delta;
    const emitInterval = 0.05 / simulationSpeed;

    if (lastEmitRef.current > emitInterval) {
      lastEmitRef.current = 0;
      const newParticles = sprinklerPositions.flatMap((pos) =>
        Array.from({ length: 5 }, () => {
          particleIdRef.current++;
          return createParticle(
            particleIdRef.current,
            pos,
            windSpeed,
            windDirection,
            0.05
          );
        })
      );
      updateStoreParticles([...particles, ...newParticles]);
    }

    const { particles: updatedParticles, maxDistance } = updateParticles(
      particles,
      windSpeed,
      windDirection,
      delta,
      simulationSpeed
    );

    if (maxDistance > maxDriftDistance) {
      setMaxDriftDistance(maxDistance);
    }

    updateStoreParticles(updatedParticles);

    const positions = particleGeometry.attributes.position.array as Float32Array;
    const colors = particleGeometry.attributes.color.array as Float32Array;
    const sizes = particleGeometry.attributes.size.array as Float32Array;

    for (let i = 0; i < 2000; i++) {
      if (i < updatedParticles.length) {
        const p = updatedParticles[i];
        positions[i * 3] = p.position[0];
        positions[i * 3 + 1] = p.position[1];
        positions[i * 3 + 2] = p.position[2];

        const alpha = 1 - p.lifetime / p.maxLifetime;
        colors[i * 3] = pesticideColor.r;
        colors[i * 3 + 1] = pesticideColor.g;
        colors[i * 3 + 2] = pesticideColor.b;
        sizes[i] = p.size * (0.5 + alpha * 0.5);
      } else {
        positions[i * 3] = 0;
        positions[i * 3 + 1] = -1000;
        positions[i * 3 + 2] = 0;
        sizes[i] = 0;
      }
    }

    particleGeometry.attributes.position.needsUpdate = true;
    particleGeometry.attributes.color.needsUpdate = true;
    particleGeometry.attributes.size.needsUpdate = true;

    checkDriftAlerts(updatedParticles, adjacentFields, canal, bufferThreshold, addAlert);
  });

  useEffect(() => {
    const positions = particleGeometry.attributes.position.array as Float32Array;
    for (let i = 0; i < 2000; i++) {
      positions[i * 3 + 1] = -1000;
    }
    particleGeometry.attributes.position.needsUpdate = true;
  }, [particleGeometry]);

  return (
    <points ref={pointsRef} geometry={particleGeometry}>
      <pointsMaterial
        size={0.3}
        vertexColors
        transparent
        opacity={0.7}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}