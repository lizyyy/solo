import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Anomaly } from '../../types';
import { latLngToWorldPosition } from '../../utils/geoCalculator';
import { mockBuoys } from '../../data/mockBuoys';

interface AnomalyAreaProps {
  anomaly: Anomaly;
  isSelected: boolean;
  onClick: () => void;
}

export function AnomalyArea({ anomaly, isSelected, onClick }: AnomalyAreaProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const innerRingRef = useRef<THREE.Mesh>(null);

  const buoy = mockBuoys.find((b) => b.id === anomaly.buoyId);

  const position = useMemo(() => {
    if (!buoy) return [0, 0, 0] as [number, number, number];
    return latLngToWorldPosition(buoy.lat, buoy.lng);
  }, [buoy]);

  const radius = useMemo(() => {
    const levelMultiplier = {
      low: 2,
      medium: 3,
      high: 4,
      critical: 5,
    };
    return levelMultiplier[anomaly.level];
  }, [anomaly.level]);

  const color = useMemo(() => {
    const colors = {
      low: '#2ED573',
      medium: '#FFA502',
      high: '#FF6348',
      critical: '#FF4757',
    };
    return new THREE.Color(colors[anomaly.level]);
  }, [anomaly.level]);

  useFrame((state) => {
    if (ringRef.current) {
      const time = state.clock.elapsedTime;
      const pulseScale = 1 + Math.sin(time * 2) * 0.2;
      ringRef.current.scale.set(pulseScale, pulseScale, pulseScale);
      const material = ringRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.4 + Math.sin(time * 2) * 0.2;
    }

    if (innerRingRef.current) {
      const time = state.clock.elapsedTime;
      const rotateSpeed = isSelected ? 2 : 0.5;
      innerRingRef.current.rotation.z = time * rotateSpeed;
    }
  });

  if (!buoy) return null;

  return (
    <group
      ref={groupRef}
      position={[position[0], 0.1, position[2]]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
    >
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.8, radius, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.5}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={innerRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[radius * 0.5, radius * 0.7, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[radius * 0.4, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isSelected ? 0.3 : 0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {isSelected && (
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[radius, radius + 0.3, 64]} />
          <meshBasicMaterial color="#00D4FF" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}

      <mesh position={[0, 0.2, 0]}>
        <coneGeometry args={[0.3, 1.5, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>
    </group>
  );
}
