import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { SoundSource as SoundSourceType } from '../../data/models/acoustic';
import { vec3ToArray } from '../../utils/geometryBuilder';

interface SoundSourceProps {
  sources: SoundSourceType[];
  showLabel?: boolean;
}

export function SoundSources({ sources, showLabel = true }: SoundSourceProps) {
  const pulseRef = useRef<THREE.Group>(null);
  const glowRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (pulseRef.current) {
      pulseRef.current.children.forEach((child, i) => {
        const mesh = child as THREE.Mesh;
        const scale = 1 + Math.sin(time * 2 + i) * 0.3;
        mesh.scale.setScalar(scale);
        (mesh.material as THREE.Material).opacity = Math.max(0, 0.6 - Math.abs(Math.sin(time * 2 + i)) * 0.5);
      });
    }

    if (glowRef.current) {
      const glowIntensity = 0.8 + Math.sin(time * 3) * 0.2;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = glowIntensity;
    }
  });

  return (
    <group>
      {sources.map((source) => (
        <group key={source.id} position={vec3ToArray(source.position)}>
          <mesh ref={glowRef}>
            <sphereGeometry args={[0.3, 32, 32]} />
            <meshBasicMaterial color="#ffd700" transparent opacity={0.9} />
          </mesh>

          <mesh>
            <sphereGeometry args={[0.15, 16, 16]} />
            <meshStandardMaterial
              color="#ff6b35"
              emissive="#ff4500"
              emissiveIntensity={1.5}
              metalness={0.8}
              roughness={0.2}
            />
          </mesh>

          <group ref={pulseRef}>
            {[1, 2, 3].map((i) => (
              <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.2 + i * 0.15, 0.25 + i * 0.15, 64]} />
                <meshBasicMaterial
                  color={source.type === 'directional' ? '#4fc3f7' : '#ffd700'}
                  transparent
                  opacity={0.5}
                  side={THREE.DoubleSide}
                />
              </mesh>
            ))}
          </group>

          {source.type === 'directional' && (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.4, 1, 32, 1, true]} />
              <meshBasicMaterial
                color="#4fc3f7"
                transparent
                opacity={0.15}
                side={THREE.DoubleSide}
              />
            </mesh>
          )}

          <pointLight
            color="#ff6b35"
            intensity={2}
            distance={8}
            decay={2}
          />

          {showLabel && (
            <group position={[0, 0.8, 0]}>
              <mesh>
                <planeGeometry args={[3, 0.5]} />
                <meshBasicMaterial color="#0a0e1a" transparent opacity={0.8} />
              </mesh>
            </group>
          )}
        </group>
      ))}
    </group>
  );
}
