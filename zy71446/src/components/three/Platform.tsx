import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { platforms } from '../../data/stationConfig';
import { useSimulationStore } from '../../store/useSimulationStore';

interface SinglePlatformProps {
  platform: typeof platforms[0];
}

function SinglePlatform({ platform }: SinglePlatformProps) {
  const trainRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const crowdData = useSimulationStore((state) => state.crowdData);
  const activeAnomalies = useSimulationStore((state) => state.activeAnomalies);

  const zoneData = crowdData.get(platform.id);
  const count = zoneData?.count || 0;
  const capacity = platform.capacity;
  const percentage = (count / capacity) * 100;

  const hasWarning = activeAnomalies.some(
    (a) => (a.type === 'capacity_warning' || a.type === 'over_capacity') && a.zoneId === platform.id
  );
  const hasOverCapacity = activeAnomalies.some(
    (a) => a.type === 'over_capacity' && a.zoneId === platform.id
  );

  const platformColor = useMemo(() => {
    if (hasOverCapacity) return '#FF3B30';
    if (hasWarning) return '#FFB800';
    return '#2d3748';
  }, [hasOverCapacity, hasWarning]);

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (trainRef.current) {
      const offset = Math.sin(timeRef.current * 0.3) * 0.1;
      trainRef.current.position.x = offset;
    }
  });

  const densityColor = percentage > 120 ? '#FF3B30' : percentage > 90 ? '#FFB800' : '#00ff88';

  return (
    <group position={platform.position}>
      <mesh position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={platform.size} />
        <meshStandardMaterial
          color={platformColor}
          roughness={0.7}
          metalness={0.3}
          emissive={hasWarning || hasOverCapacity ? platformColor : '#000000'}
          emissiveIntensity={hasOverCapacity ? 0.3 : hasWarning ? 0.15 : 0}
        />
      </mesh>

      <mesh position={[0, 0.11, platform.size[2] / 2 - 0.2]}>
        <boxGeometry args={[platform.size[0], 0.2, 0.3]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={0.3}
        />
      </mesh>

      <mesh position={[0, 0.11, -platform.size[2] / 2 + 0.2]}>
        <boxGeometry args={[platform.size[0], 0.2, 0.3]} />
        <meshStandardMaterial
          color="#fbbf24"
          emissive="#fbbf24"
          emissiveIntensity={0.3}
        />
      </mesh>

      <group ref={trainRef} position={[0, 1.5, 0]}>
        <mesh>
          <boxGeometry args={[platform.size[0] - 2, 2.5, 2.5]} />
          <meshStandardMaterial
            color="#1e40af"
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>
        <mesh position={[0, 0.5, 1.3]}>
          <boxGeometry args={[platform.size[0] - 3, 1, 0.1]} />
          <meshStandardMaterial
            color="#60a5fa"
            emissive="#60a5fa"
            emissiveIntensity={0.5}
          />
        </mesh>
        <mesh position={[0, -0.8, 0]}>
          <boxGeometry args={[platform.size[0] - 1, 0.3, 3]} />
          <meshStandardMaterial
            color="#374151"
            roughness={0.8}
            metalness={0.2}
          />
        </mesh>

        {[-8, -4, 0, 4, 8].map((x, i) => (
          <mesh key={i} position={[x, -1.3, 1.8]}>
            <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
            <meshStandardMaterial
              color="#1f2937"
              roughness={0.5}
              metalness={0.5}
            />
          </mesh>
        ))}

        {[-8, -4, 0, 4, 8].map((x, i) => (
          <mesh key={i} position={[x, -1.3, -1.8]}>
            <cylinderGeometry args={[0.3, 0.3, 0.2, 16]} />
            <meshStandardMaterial
              color="#1f2937"
              roughness={0.5}
              metalness={0.5}
            />
          </mesh>
        ))}
      </group>

      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[Math.min(platform.size[0] / 2 - 1, 10), Math.min(platform.size[0] / 2, 11), 4]} />
        <meshBasicMaterial
          color={densityColor}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {[[-10, 3, 0], [10, 3, 0]].map((pos, i) => (
        <group key={i} position={pos as [number, number, number]}>
          <mesh>
            <boxGeometry args={[0.1, 2, 1.5]} />
            <meshStandardMaterial
              color="#1e293b"
              roughness={0.3}
              metalness={0.7}
            />
          </mesh>
          <mesh position={[0.06, 0, 0]}>
            <boxGeometry args={[0.02, 1.2, 1]} />
            <meshStandardMaterial
              color={platform.line === '1号线' ? '#e11d48' : '#16a34a'}
              emissive={platform.line === '1号线' ? '#e11d48' : '#16a34a'}
              emissiveIntensity={0.6}
              transparent
              opacity={0.9}
            />
          </mesh>
        </group>
      ))}

      {[[-8, 2, 3], [-4, 2, 3], [0, 2, 3], [4, 2, 3], [8, 2, 3]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]}>
          <cylinderGeometry args={[0.2, 0.25, 0.15, 16]} />
          <meshStandardMaterial
            color="#ffffff"
            emissive="#ffffff"
            emissiveIntensity={0.8}
          />
        </mesh>
      ))}
    </group>
  );
}

export function PlatformGroup() {
  return (
    <group>
      {platforms.map((p) => (
        <SinglePlatform key={p.id} platform={p} />
      ))}

      <mesh position={[-5, -1.5, 10]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[3, 3, 0.3]} />
        <meshStandardMaterial
          color="#e11d48"
          emissive="#e11d48"
          emissiveIntensity={0.4}
          transparent
          opacity={0.8}
        />
      </mesh>

      <mesh position={[5, -4.5, -10]} rotation={[0, -Math.PI / 4, 0]}>
        <boxGeometry args={[3, 3, 0.3]} />
        <meshStandardMaterial
          color="#16a34a"
          emissive="#16a34a"
          emissiveIntensity={0.4}
          transparent
          opacity={0.8}
        />
      </mesh>
    </group>
  );
}
