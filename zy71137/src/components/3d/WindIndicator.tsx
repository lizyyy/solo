import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { COLORS } from '@/data/constants';
import * as THREE from 'three';

interface WindIndicatorProps {
  windSpeed: number;
  windDirection: number;
}

export function WindIndicator({ windSpeed, windDirection }: WindIndicatorProps) {
  const arrowRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  const arrowLength = 3 + windSpeed * 0.5;

  useFrame(() => {
    if (arrowRef.current) {
      arrowRef.current.rotation.y = (windDirection * Math.PI) / 180;
    }
    if (particlesRef.current) {
      const positions = particlesRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < positions.length; i += 3) {
        positions[i] += (Math.sin((windDirection * Math.PI) / 180)) * 0.05 * windSpeed;
        positions[i + 2] += (Math.cos((windDirection * Math.PI) / 180)) * 0.05 * windSpeed;

        if (Math.abs(positions[i]) > 15 || Math.abs(positions[i + 2]) > 15) {
          positions[i] = (Math.random() - 0.5) * 20;
          positions[i + 1] = Math.random() * 10 + 2;
          positions[i + 2] = (Math.random() - 0.5) * 20;
        }
      }
      particlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  const particlePositions = new Float32Array(100 * 3);
  for (let i = 0; i < 100; i++) {
    particlePositions[i * 3] = (Math.random() - 0.5) * 20;
    particlePositions[i * 3 + 1] = Math.random() * 10 + 2;
    particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
  }

  return (
    <group position={[0, 12, 0]}>
      <mesh position={[0, 0, 0]}>
        <ringGeometry args={[5, 5.5, 32]} />
        <meshBasicMaterial color={COLORS.canal} transparent opacity={0.3} />
      </mesh>

      <group ref={arrowRef}>
        <mesh position={[0, 0, -arrowLength / 2]}>
          <cylinderGeometry args={[0.2, 0.2, arrowLength, 8]} />
          <meshStandardMaterial color={COLORS.sprinkler} />
        </mesh>
        <mesh position={[0, 0, -arrowLength]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.5, 1, 8]} />
          <meshStandardMaterial color={COLORS.sprinkler} />
        </mesh>
      </group>

      <points ref={particlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={100}
            array={particlePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.15}
          color={COLORS.canal}
          transparent
          opacity={0.6}
          sizeAttenuation
        />
      </points>
    </group>
  );
}