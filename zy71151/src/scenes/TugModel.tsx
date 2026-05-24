import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Tug, TugStatus } from '../types';

interface TugModelProps {
  tug: Tug;
  isSelected: boolean;
  onClick?: () => void;
}

const getTugColor = (status: TugStatus): string => {
  switch (status) {
    case 'idle':
      return '#9fb3c8';
    case 'moving':
      return '#4d94ff';
    case 'towing':
      return '#F77F00';
    case 'returning':
      return '#829ab1';
    default:
      return '#9fb3c8';
  }
};

export function TugModel({ tug, isSelected, onClick }: TugModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const length = 1.5;
  const width = 0.6;
  const height = 0.5;

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(tug.position.x / 10, tug.position.y / 10 + 0.1, tug.position.z / 10);
      groupRef.current.rotation.y = tug.rotation;
    }
  });

  const tugColor = getTugColor(tug.status);
  const fuelPercentage = tug.fuel / tug.maxFuel;

  return (
    <group ref={groupRef} onClick={onClick}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[width, height, length]} />
        <meshStandardMaterial color={tugColor} metalness={0.4} roughness={0.6} />
      </mesh>

      <mesh position={[0, height * 1.5, length * 0.1]} castShadow>
        <boxGeometry args={[width * 0.7, height * 1.2, length * 0.5]} />
        <meshStandardMaterial color="#1a1a2e" metalness={0.6} roughness={0.4} />
      </mesh>

      <mesh position={[0, height * 0.1, -length * 0.35]}>
        <cylinderGeometry args={[0.1, 0.15, height * 0.4, 8]} />
        <meshStandardMaterial color="#2c3e50" />
      </mesh>

      {isSelected && (
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[length * 0.6, length * 0.8, 32]} />
          <meshBasicMaterial color={tugColor} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      )}

      <group position={[0, height * 2.2, 0]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.5, 0.05, 0.15]} />
          <meshBasicMaterial color="#333" />
        </mesh>
        <mesh position={[(fuelPercentage - 0.5) * 0.45, 0.1, 0]}>
          <boxGeometry args={[Math.max(0.05, fuelPercentage * 0.45), 0.08, 0.1]} />
          <meshBasicMaterial color={fuelPercentage > 0.3 ? '#2ecc71' : fuelPercentage > 0.1 ? '#f39c12' : '#e74c3c'} />
        </mesh>
      </group>

      {tug.status === 'towing' && (
        <mesh position={[0, height * 1.2, 0]}>
          <sphereGeometry args={[0.15, 8, 8]} />
          <meshBasicMaterial color="#F77F00" />
        </mesh>
      )}
    </group>
  );
}
