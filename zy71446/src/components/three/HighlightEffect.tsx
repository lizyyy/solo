import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSimulationStore } from '../../store/useSimulationStore';
import { useUILayoutStore } from '../../store/useUILayoutStore';
import { AnomalyDetector } from '../../engine/AnomalyDetector';
import { zones } from '../../data/stationConfig';
import { Anomaly, ConflictLog } from '../../types/anomalies';

function AnomalyMarker({ anomaly }: { anomaly: Anomaly }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  const zone = zones.find((z) => z.id === anomaly.zoneId);
  if (!zone) return null;

  const color = AnomalyDetector.getAnomalyColor(anomaly.type);
  const isHigh = anomaly.severity === 'high';

  const position: [number, number, number] = [
    zone.position[0],
    zone.position[1] + 3,
    zone.position[2],
  ];

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(timeRef.current * 3) * 0.3;
      meshRef.current.rotation.y += delta * 2;

      const mat = meshRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.5 + Math.sin(timeRef.current * 4) * 0.3;
    }

    if (ringRef.current) {
      const scale = 1 + Math.sin(timeRef.current * 2) * 0.2;
      ringRef.current.scale.setScalar(scale);
      ringRef.current.rotation.y += delta;
    }
  });

  return (
    <group position={position}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[isHigh ? 1.5 : 1, 0.1, 8, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          transparent
          opacity={0.8}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={meshRef}>
        {isHigh ? (
          <octahedronGeometry args={[0.6, 0]} />
        ) : (
          <dodecahedronGeometry args={[0.5, 0]} />
        )}
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.8}
          transparent
          opacity={0.9}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      <mesh position={[0, -0.8, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.5, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          transparent
          opacity={0.6}
        />
      </mesh>
    </group>
  );
}

function ZoneHighlight({ zoneId, anomaly }: { zoneId: string; anomaly?: Anomaly }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  const zone = zones.find((z) => z.id === zoneId);
  if (!zone) return null;

  const color = anomaly ? AnomalyDetector.getAnomalyColor(anomaly.type) : '#00D4FF';
  const intensity = anomaly ? (anomaly.severity === 'high' ? 0.6 : 0.4) : 0.2;

  const position: [number, number, number] = [
    zone.position[0],
    zone.position[1] + 0.05,
    zone.position[2],
  ];

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (meshRef.current) {
      const mat = meshRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = intensity + Math.sin(timeRef.current * 3) * 0.15;
    }
  });

  return (
    <mesh ref={meshRef} position={position} rotation={[-Math.PI / 2, 0, 0]}>
      <boxGeometry args={[zone.size[0] * 0.9, zone.size[2] * 0.9, 0.1]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={intensity}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function ConflictMarker({ conflict }: { conflict: ConflictLog }) {
  const meshRef = useRef<THREE.Group>(null);
  const timeRef = useRef(0);

  const position: [number, number, number] = [
    Math.random() * 4 - 2,
    4,
    Math.random() * 4 - 2,
  ];

  useFrame((_, delta) => {
    timeRef.current += delta;

    if (meshRef.current) {
      meshRef.current.position.y = position[1] + Math.sin(timeRef.current * 5) * 0.2;
      meshRef.current.rotation.y += delta * 3;
      meshRef.current.rotation.z = Math.sin(timeRef.current * 4) * 0.1;
    }
  });

  return (
    <group ref={meshRef} position={position}>
      <mesh rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.8, 0.8, 0.1]} />
        <meshStandardMaterial
          color="#AF52DE"
          emissive="#AF52DE"
          emissiveIntensity={0.8}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh rotation={[0, 0, -Math.PI / 4]}>
        <boxGeometry args={[0.8, 0.8, 0.1]} />
        <meshStandardMaterial
          color="#AF52DE"
          emissive="#AF52DE"
          emissiveIntensity={0.8}
          transparent
          opacity={0.9}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.3, 0]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
}

function SelectedZoneHighlight() {
  const highlightZoneId = useUILayoutStore((state) => state.highlightZoneId);

  if (!highlightZoneId) return null;

  const zone = zones.find((z) => z.id === highlightZoneId);
  if (!zone) return null;

  return (
    <ZoneHighlight zoneId={highlightZoneId} />
  );
}

export function HighlightEffect() {
  const activeAnomalies = useSimulationStore((state) => state.activeAnomalies);
  const conflictLogs = useSimulationStore((state) => state.conflictLogs);
  const currentTime = useSimulationStore((state) => state.currentTime);

  const visibleAnomalies = useMemo(() => {
    return activeAnomalies.filter((a) => {
      if (a.status === 'resolved' && a.endTime) {
        return currentTime >= a.startTime && currentTime <= a.endTime;
      }
      return currentTime >= a.startTime;
    });
  }, [activeAnomalies, currentTime]);

  const pendingConflicts = useMemo(() => {
    return conflictLogs.filter((c) => c.resolution === 'pending');
  }, [conflictLogs]);

  const highlightedZones = useMemo(() => {
    const zoneIds = new Set<string>();
    visibleAnomalies.forEach((a) => zoneIds.add(a.zoneId));
    return Array.from(zoneIds);
  }, [visibleAnomalies]);

  return (
    <group>
      {highlightedZones.map((zoneId) => {
        const anomaly = visibleAnomalies.find((a) => a.zoneId === zoneId);
        return <ZoneHighlight key={zoneId} zoneId={zoneId} anomaly={anomaly} />;
      })}

      {visibleAnomalies.map((anomaly) => (
        <AnomalyMarker key={anomaly.id} anomaly={anomaly} />
      ))}

      {pendingConflicts.slice(0, 3).map((conflict) => (
        <ConflictMarker key={conflict.id} conflict={conflict} />
      ))}

      <SelectedZoneHighlight />
    </group>
  );
}
