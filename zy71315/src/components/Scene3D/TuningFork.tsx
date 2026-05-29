import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TuningForkProps {
  frequency: number;
  isPlaying: boolean;
  position?: [number, number, number];
}

export function TuningFork({ frequency, isPlaying, position = [0, 0, 0] }: TuningForkProps) {
  const groupRef = useRef<THREE.Group>(null);
  const tineLeftRef = useRef<THREE.Mesh>(null);
  const tineRightRef = useRef<THREE.Mesh>(null);

  const vibrationAmplitude = useMemo(() => {
    return Math.min(0.02, 0.01 + (frequency - 200) * 0.00002);
  }, [frequency]);

  useFrame(({ clock }) => {
    if (!isPlaying) return;

    const time = clock.getElapsedTime();
    const vibration = Math.sin(time * frequency * 0.5) * vibrationAmplitude;

    if (tineLeftRef.current) {
      tineLeftRef.current.position.x = -0.15 + vibration;
    }
    if (tineRightRef.current) {
      tineRightRef.current.position.x = 0.15 - vibration;
    }
  });

  const metalMaterial = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x8899aa,
      metalness: 0.9,
      roughness: 0.2,
    });
  }, []);

  return (
    <group ref={groupRef} position={position}>
      <mesh position={[0, -0.3, 0]} material={metalMaterial} castShadow>
        <cylinderGeometry args={[0.02, 0.03, 0.4, 16]} />
      </mesh>

      <mesh ref={tineLeftRef} position={[-0.15, 0, 0]} material={metalMaterial} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.8, 12]} />
      </mesh>

      <mesh ref={tineRightRef} position={[0.15, 0, 0]} material={metalMaterial} castShadow>
        <cylinderGeometry args={[0.015, 0.015, 0.8, 12]} />
      </mesh>

      <mesh position={[0, 0.4, 0]} material={metalMaterial} castShadow>
        <torusGeometry args={[0.15, 0.015, 8, 32, Math.PI]} />
      </mesh>

      {isPlaying && (
        <points>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={0}
              array={new Float32Array()}
              itemSize={3}
            />
          </bufferGeometry>
          <pointsMaterial size={0.02} color={0x00f5d4} transparent opacity={0.6} />
        </points>
      )}
    </group>
  );
}
