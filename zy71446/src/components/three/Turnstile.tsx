import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { turnstiles } from '../../data/stationConfig';
import { useSimulationStore } from '../../store/useSimulationStore';

interface SingleTurnstileProps {
  turnstile: typeof turnstiles[0];
}

function SingleTurnstile({ turnstile }: SingleTurnstileProps) {
  const gateRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);
  const gateAngleRef = useRef(0);

  const activeAnomalies = useSimulationStore((state) => state.activeAnomalies);
  const crowdData = useSimulationStore((state) => state.crowdData);
  const currentTime = useSimulationStore((state) => state.currentTime);

  const zoneId = turnstile.position[2] > 0 ? 'turnstile_north' : 'turnstile_south';
  const zoneData = crowdData.get(zoneId);
  const zone = turnstile.position[2] > 0 ? 'turnstile_north' : 'turnstile_south';

  const hasOverCapacity = activeAnomalies.some(
    (a) => a.type === 'over_capacity' && a.zoneId === zone
  );

  const baseColor = useMemo(() => {
    if (turnstile.status === 'fault') return '#FF3B30';
    if (turnstile.status === 'closed') return '#666666';
    if (hasOverCapacity) return '#FF3B30';
    return '#00D4FF';
  }, [turnstile.status, hasOverCapacity]);

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (turnstile.status === 'open' && gateRef.current) {
      const targetAngle = Math.sin(timeRef.current * 3) > 0.7 ? 0.8 : 0;
      gateAngleRef.current += (targetAngle - gateAngleRef.current) * delta * 5;

      gateRef.current.rotation.y = gateAngleRef.current;
    }

    if (lightRef.current) {
      const mat = lightRef.current.material as THREE.MeshStandardMaterial;
      if (turnstile.status === 'open') {
        mat.emissiveIntensity = 0.6 + Math.sin(timeRef.current * 2) * 0.3;
      } else if (turnstile.status === 'fault') {
        mat.emissiveIntensity = 0.3 + Math.sin(timeRef.current * 8) * 0.5;
      } else {
        mat.emissiveIntensity = 0.2;
      }
    }
  });

  const throughput = zoneData ? Math.floor(zoneData.count / 6) : 0;
  const queueLength = turnstile.queueLength || 0;

  return (
    <group position={turnstile.position}>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[0.8, 1, 0.3]} />
        <meshStandardMaterial
          color="#2d3748"
          roughness={0.4}
          metalness={0.6}
        />
      </mesh>

      <mesh ref={lightRef} position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
        <meshStandardMaterial
          color={baseColor}
          emissive={baseColor}
          emissiveIntensity={0.6}
        />
      </mesh>

      <group ref={gateRef} position={[0, 0.4, 0]}>
        <mesh position={[0.35, 0, 0]}>
          <boxGeometry args={[0.05, 0.7, 0.02]} />
          <meshStandardMaterial
            color={turnstile.status === 'open' ? '#00D4FF' : '#FF3B30'}
            emissive={turnstile.status === 'open' ? '#00D4FF' : '#FF3B30'}
            emissiveIntensity={0.5}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
        <mesh position={[-0.35, 0, 0]}>
          <boxGeometry args={[0.05, 0.7, 0.02]} />
          <meshStandardMaterial
            color={turnstile.status === 'open' ? '#00D4FF' : '#FF3B30'}
            emissive={turnstile.status === 'open' ? '#00D4FF' : '#FF3B30'}
            emissiveIntensity={0.5}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      </group>

      <mesh position={[0, 0.05, 0]}>
        <boxGeometry args={[1, 0.1, 0.5]} />
        <meshStandardMaterial
          color="#1a202c"
          roughness={0.5}
          metalness={0.5}
        />
      </mesh>

      {queueLength > 0 && (
        <group position={[0, 0.02, turnstile.position[2] > 0 ? 0.8 : -0.8]}>
          {Array.from({ length: Math.min(queueLength, 5) }).map((_, i) => (
            <mesh key={i} position={[0, 0.5 + i * 0.05, turnstile.position[2] > 0 ? i * 0.4 : -i * 0.4]}>
              <cylinderGeometry args={[0.15, 0.15, 1, 8]} />
              <meshStandardMaterial
                color="#FFB800"
                emissive="#FFB800"
                emissiveIntensity={0.3}
                transparent
                opacity={0.6 - i * 0.1}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
}

export function TurnstileGroup() {
  return (
    <group>
      {turnstiles.map((ts) => (
        <SingleTurnstile key={ts.id} turnstile={ts} />
      ))}

      <mesh position={[0, 0.01, 10]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5, 6.5, 4]} />
        <meshBasicMaterial
          color="#00D4FF"
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.01, -10]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[5, 6.5, 4]} />
        <meshBasicMaterial
          color="#ff6600"
          transparent
          opacity={0.2}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
