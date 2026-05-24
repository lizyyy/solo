import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Ship, ShipType } from '../types';

interface ShipModelProps {
  ship: Ship;
  isSelected: boolean;
  onClick?: () => void;
}

const getShipColor = (type: ShipType): string => {
  switch (type) {
    case 'cargo':
      return '#4a90d9';
    case 'container':
      return '#e74c3c';
    case 'tanker':
      return '#2ecc71';
    default:
      return '#4a90d9';
  }
};

const getStatusColor = (status: Ship['status']): string => {
  switch (status) {
    case 'approaching':
      return '#f39c12';
    case 'waiting':
      return '#9b59b6';
    case 'docking':
      return '#3498db';
    case 'docked':
      return '#2ecc71';
    case 'undocking':
      return '#e67e22';
    case 'departing':
      return '#95a5a6';
    default:
      return '#ffffff';
  }
};

export function ShipModel({ ship, isSelected, onClick }: ShipModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const length = ship.length / 10;
  const width = length * 0.3;
  const height = length * 0.4;

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(ship.position.x / 10, ship.position.y / 10, ship.position.z / 10);
      groupRef.current.rotation.y = ship.rotation;
    }
  });

  const shipColor = getShipColor(ship.type);
  const statusColor = getStatusColor(ship.status);

  return (
    <group ref={groupRef} onClick={onClick}>
      <mesh position={[0, height / 2, 0]} castShadow>
        <boxGeometry args={[width, height, length]} />
        <meshStandardMaterial color={shipColor} metalness={0.3} roughness={0.7} />
      </mesh>

      <mesh position={[0, height * 1.2, length * 0.2]} castShadow>
        <boxGeometry args={[width * 0.6, height * 0.8, length * 0.4]} />
        <meshStandardMaterial color="#34495e" metalness={0.5} roughness={0.5} />
      </mesh>

      <mesh position={[0, height * 0.1, -length * 0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[width * 0.1, width * 0.15, height * 0.3, 8]} />
        <meshStandardMaterial color="#2c3e50" />
      </mesh>

      {isSelected && (
        <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[length * 0.6, length * 0.7, 32]} />
          <meshBasicMaterial color={statusColor} transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}

      <mesh position={[0, height * 2, 0]}>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color={statusColor} />
      </mesh>

      {ship.assignedTugIds.length > 0 && (
        <mesh position={[0, height * 0.5, length * 0.4]}>
          <sphereGeometry args={[0.2, 8, 8]} />
          <meshBasicMaterial color="#F77F00" />
        </mesh>
      )}
    </group>
  );
}
