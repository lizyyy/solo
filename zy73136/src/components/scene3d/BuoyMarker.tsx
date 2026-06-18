import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Buoy, Anomaly } from '../../types';
import { latLngToWorldPosition } from '../../utils/geoCalculator';

interface BuoyMarkerProps {
  buoy: Buoy;
  isSelected: boolean;
  hasAnomaly: boolean;
  anomalyLevel?: Anomaly['level'];
  onClick: () => void;
}

export function BuoyMarker({ buoy, isSelected, hasAnomaly, anomalyLevel, onClick }: BuoyMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const pulseRef = useRef<THREE.Mesh>(null);

  const position = useMemo(() => {
    return latLngToWorldPosition(buoy.lat, buoy.lng);
  }, [buoy.lat, buoy.lng]);

  const color = useMemo(() => {
    if (hasAnomaly) {
      switch (anomalyLevel) {
        case 'critical':
          return new THREE.Color('#FF4757');
        case 'high':
          return new THREE.Color('#FF6348');
        case 'medium':
          return new THREE.Color('#FFA502');
        default:
          return new THREE.Color('#2ED573');
      }
    }
    return new THREE.Color('#00D4FF');
  }, [hasAnomaly, anomalyLevel]);

  useFrame((state) => {
    if (groupRef.current) {
      const time = state.clock.elapsedTime;
      groupRef.current.position.y = position[1] + Math.sin(time * 2 + position[0]) * 0.15 + 1;
      groupRef.current.rotation.y = Math.sin(time * 0.5) * 0.1;
    }

    if (pulseRef.current && hasAnomaly) {
      const time = state.clock.elapsedTime;
      const scale = 1 + Math.sin(time * 3) * 0.3;
      pulseRef.current.scale.set(scale, scale, scale);
      const material = pulseRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = 0.3 + Math.sin(time * 3) * 0.2;
    }

    if (lightRef.current && hasAnomaly) {
      const time = state.clock.elapsedTime;
      lightRef.current.intensity = 1 + Math.sin(time * 3) * 0.5;
    }
  });

  return (
    <group
      ref={groupRef}
      position={[position[0], position[1] + 1, position[2]]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        document.body.style.cursor = 'default';
      }}
    >
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[0.3, 0.5, 0.8, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.8 : 0.3}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      <mesh position={[0, 0.6, 0]}>
        <sphereGeometry args={[0.4, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 1 : 0.5}
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>

      {isSelected && (
        <mesh position={[0, 1.2, 0]}>
          <ringGeometry args={[0.5, 0.6, 32]} />
          <meshBasicMaterial color="#00D4FF" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}

      {hasAnomaly && (
        <>
          <mesh ref={pulseRef} position={[0, 0, 0]}>
            <sphereGeometry args={[1, 16, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
          </mesh>
          <pointLight ref={lightRef} color={color} intensity={1} distance={8} />
        </>
      )}

      <mesh position={[0, -0.5, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 3, 8]} />
        <meshStandardMaterial color="#1E3A5F" metalness={0.9} roughness={0.1} />
      </mesh>
      <mesh position={[0, -2, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#1E3A5F" metalness={0.9} roughness={0.1} />
      </mesh>
    </group>
  );
}
