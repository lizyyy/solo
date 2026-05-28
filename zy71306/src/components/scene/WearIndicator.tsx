import { useMemo } from 'react';
import * as THREE from 'three';

interface WearIndicatorProps {
  wearLevel: number;
}

export default function WearIndicator({ wearLevel }: WearIndicatorProps) {
  const wearColor = useMemo(() => {
    if (wearLevel < 30) return '#2E7D32';
    if (wearLevel < 60) return '#F59E0B';
    return '#C41E3A';
  }, [wearLevel]);

  const wearOpacity = useMemo(() => {
    return 0.1 + (wearLevel / 100) * 0.6;
  }, [wearLevel]);

  const wearRadius = useMemo(() => {
    return 0.5 + (wearLevel / 100) * 0.3;
  }, [wearLevel]);

  const scratchCount = useMemo(() => {
    return Math.floor(wearLevel / 10);
  }, [wearLevel]);

  const scratches = useMemo(() => {
    return Array.from({ length: scratchCount }).map((_, i) => ({
      angle: (i / scratchCount) * Math.PI * 2 + Math.random() * 0.5,
      radius: 0.6 + Math.random() * 0.5,
      length: 0.05 + Math.random() * 0.1,
      opacity: 0.3 + Math.random() * 0.4,
    }));
  }, [scratchCount]);

  return (
    <group>
      <mesh rotation={[0, 0, 0]}>
        <ringGeometry args={[0.5, wearRadius + 0.2, 64]} />
        <meshBasicMaterial
          color={wearColor}
          transparent
          opacity={wearOpacity * 0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh rotation={[0, 0, 0]}>
        <ringGeometry args={[wearRadius - 0.05, wearRadius, 64]} />
        <meshBasicMaterial
          color={wearColor}
          transparent
          opacity={wearOpacity * 0.6}
          side={THREE.DoubleSide}
        />
      </mesh>

      {scratches.map((scratch, i) => (
        <mesh
          key={`scratch-${i}`}
          position={[
            Math.cos(scratch.angle) * scratch.radius,
            0.001,
            Math.sin(scratch.angle) * scratch.radius,
          ]}
          rotation={[0, scratch.angle, 0]}
        >
          <planeGeometry args={[scratch.length, 0.002]} />
          <meshBasicMaterial
            color="#1a1a1a"
            transparent
            opacity={scratch.opacity}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}

      {wearLevel > 50 && (
        <group>
          {Array.from({ length: Math.floor((wearLevel - 50) / 10) }).map((_, i) => (
            <mesh
              key={`spark-${i}`}
              position={[
                Math.cos(i * 1.2) * (0.7 + (i % 3) * 0.1),
                0.002,
                Math.sin(i * 1.2) * (0.7 + (i % 3) * 0.1),
              ]}
            >
              <sphereGeometry args={[0.01, 8, 8]} />
              <meshBasicMaterial
                color="#FF6B35"
                transparent
                opacity={0.5 + Math.random() * 0.3}
              />
            </mesh>
          ))}
        </group>
      )}

      {wearLevel > 70 && (
        <mesh position={[0, 0.05, 0]}>
          <pointLight color="#C41E3A" intensity={0.5} distance={1} />
        </mesh>
      )}
    </group>
  );
}
