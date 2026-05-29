import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface SoundWavesProps {
  frequency: number;
  isPlaying: boolean;
  position?: [number, number, number];
}

export function SoundWaves({ frequency, isPlaying, position = [0, 0, 0] }: SoundWavesProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringsRef = useRef<THREE.Mesh[]>([]);

  const ringCount = 8;

  const rings = useMemo(() => {
    return Array.from({ length: ringCount }, (_, i) => ({
      index: i,
      delay: i * 0.15,
      baseRadius: 0.1 + i * 0.05,
    }));
  }, []);

  useFrame(({ clock }) => {
    if (!isPlaying || !groupRef.current) return;

    const time = clock.getElapsedTime();
    const waveSpeed = frequency * 0.01;

    ringsRef.current.forEach((ring, i) => {
      if (!ring) return;

      const phase = (time * waveSpeed + rings[i].delay) % 1;
      const radius = rings[i].baseRadius + phase * 1.5;
      const opacity = Math.max(0, 1 - phase);

      ring.scale.setScalar(radius / rings[i].baseRadius);
      (ring.material as THREE.MeshBasicMaterial).opacity = opacity * 0.4;
    });
  });

  return (
    <group ref={groupRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      {isPlaying && rings.map((ring, index) => (
        <mesh
          key={ring.index}
          ref={(el) => {
            if (el) ringsRef.current[index] = el;
          }}
        >
          <ringGeometry args={[0.98, 1, 64]} />
          <meshBasicMaterial
            color={0x00f5d4}
            transparent
            opacity={0}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}
