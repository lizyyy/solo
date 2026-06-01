import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { STATUS_COLORS } from '@/types';
import type { PointLocation, PointStatus } from '@/types';

interface FieldLineProps {
  points: PointLocation[];
  onPointClick: (id: string) => void;
  selectedPointId: string | null;
}

function PointSphere({ point, isSelected, onClick }: { point: PointLocation; isSelected: boolean; onClick: () => void }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const color = STATUS_COLORS[point.status];
  const isAnomaly = point.status !== 'pass';

  useFrame((state) => {
    if (meshRef.current) {
      if (isAnomaly) {
        const pulse = Math.sin(state.clock.elapsedTime * 3) * 0.15 + 0.85;
        meshRef.current.scale.setScalar(pulse * (isSelected ? 1.5 : 1));
      } else {
        meshRef.current.scale.setScalar(isSelected ? 1.5 : 1);
      }
    }
    if (glowRef.current) {
      if (isAnomaly) {
        const glowPulse = Math.sin(state.clock.elapsedTime * 2) * 0.3 + 0.7;
        glowRef.current.scale.setScalar(2 * glowPulse * (isSelected ? 1.5 : 1));
        (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.15 * glowPulse;
      } else if (isSelected) {
        glowRef.current.scale.setScalar(2);
        (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.2;
      } else {
        glowRef.current.scale.setScalar(1);
        (glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0;
      }
    }
  });

  return (
    <group position={[point.x, point.y, point.z]}>
      <mesh ref={meshRef} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={isAnomaly ? color : '#000000'}
          emissiveIntensity={isAnomaly ? 0.6 : 0}
          roughness={0.3}
          metalness={0.5}
        />
      </mesh>
      <mesh ref={glowRef}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

function FieldLines({ points }: { points: PointLocation[] }) {
  const lineData = useMemo(() => {
    const lines: { start: [number, number, number]; end: [number, number, number]; color: string }[] = [];
    const sortedBySource: Record<string, PointLocation[]> = {};
    points.forEach((p) => {
      if (!sortedBySource[p.source]) sortedBySource[p.source] = [];
      sortedBySource[p.source].push(p);
    });
    Object.values(sortedBySource).forEach((group) => {
      group.sort((a, b) => a.id.localeCompare(b.id));
      for (let i = 0; i < group.length - 1; i++) {
        lines.push({
          start: [group[i].x, group[i].y, group[i].z],
          end: [group[i + 1].x, group[i + 1].y, group[i + 1].z],
          color: STATUS_COLORS[group[i].status as PointStatus],
        });
      }
    });
    return lines;
  }, [points]);

  return (
    <group>
      {lineData.map((line, i) => (
        <Line
          key={i}
          points={[line.start, line.end]}
          color={line.color}
          lineWidth={1.5}
          transparent
          opacity={0.6}
        />
      ))}
    </group>
  );
}

function AxisLines() {
  return (
    <>
      <Line points={[[0, 0, 0], [15, 0, 0]]} color="#e94560" lineWidth={1} transparent opacity={0.4} />
      <Line points={[[0, 0, 0], [0, 15, 0]]} color="#16c79a" lineWidth={1} transparent opacity={0.4} />
      <Line points={[[0, 0, 0], [0, 0, 15]]} color="#4a90d9" lineWidth={1} transparent opacity={0.4} />
    </>
  );
}

export default function FieldScene({ points, onPointClick, selectedPointId }: FieldLineProps) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <directionalLight position={[5, 10, 5]} intensity={0.8} />
      <directionalLight position={[-5, 8, -5]} intensity={0.4} color="#4a90d9" />
      <directionalLight position={[0, 5, -8]} intensity={0.3} color="#e94560" />

      <gridHelper args={[30, 30, '#1a3a5c', '#0d1f33']} position={[0, 0, 0]} />

      <AxisLines />
      <FieldLines points={points} />

      {points.map((point) => (
        <PointSphere
          key={point.id}
          point={point}
          isSelected={selectedPointId === point.id}
          onClick={() => onPointClick(point.id)}
        />
      ))}

      <fog attach="fog" args={['#0a0a1a', 20, 50]} />
    </>
  );
}
