import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { RiskPoint } from '../types';

interface RiskMarkerProps {
  risk: RiskPoint;
}

export function RiskMarker({ risk }: RiskMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const pulseRef = useRef(0);

  useFrame((_, delta) => {
    pulseRef.current += delta * 3;
    if (groupRef.current) {
      const scale = 1 + Math.sin(pulseRef.current) * 0.1;
      groupRef.current.scale.setScalar(scale);
    }
  });

  const color = risk.level === 'danger' ? '#F53F3F' : '#FF7D00';

  return (
    <group ref={groupRef} position={[risk.position[0], risk.position[1] + 0.5, risk.position[2]]}>
      <mesh position={[0, 0.5, 0]}>
        <coneGeometry args={[0.4, 1, 4]} />
        <meshBasicMaterial color={color} transparent opacity={0.8} />
      </mesh>

      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.2, 0.6, 32]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.5} />
      </mesh>

      <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.4, 0.02, 8, 32]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

interface HeightIndicatorProps {
  position: [number, number, number];
  height: number;
}

export function HeightIndicator({ position, height }: HeightIndicatorProps) {
  return (
    <group position={position}>
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.02, 0.02, height, 8]} />
        <meshBasicMaterial color="#FFD700" />
      </mesh>

      <mesh position={[0, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.03, 8]} />
        <meshBasicMaterial color="#FFD700" />
      </mesh>

      <mesh position={[0, height, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.1, 0.1, 0.03, 8]} />
        <meshBasicMaterial color="#FFD700" />
      </mesh>
    </group>
  );
}

interface EntranceSignProps {
  position: [number, number, number];
  text: string;
  height: number;
}

export function EntranceSign({ position, height }: EntranceSignProps) {
  return (
    <group position={position}>
      <mesh position={[0, height / 2 + 0.4, 0]}>
        <boxGeometry args={[2, 0.8, 0.1]} />
        <meshStandardMaterial color="#F53F3F" />
      </mesh>

      <mesh position={[-0.8, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, height, 8]} />
        <meshStandardMaterial color="#4A5568" />
      </mesh>
      <mesh position={[0.8, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, height, 8]} />
        <meshStandardMaterial color="#4A5568" />
      </mesh>
    </group>
  );
}
