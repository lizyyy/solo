import { useRef } from 'react';
import { ThreeEvent } from '@react-three/fiber';
import { Facility as FacilityType } from '../../types';
import * as THREE from 'three';

interface FacilityProps {
  facility: FacilityType;
  onClick?: (facility: FacilityType) => void;
  showRamps: boolean;
  showElevators: boolean;
}

export const FacilityModel = ({ facility, onClick, showRamps, showElevators }: FacilityProps) => {
  const meshRef = useRef<THREE.Group>(null);

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick?.(facility);
  };

  if (facility.type === 'ramp' && !showRamps) return null;
  if (facility.type === 'elevator' && !showElevators) return null;

  const getStatusColor = () => {
    switch (facility.status) {
      case 'active':
        return '#00B42A';
      case 'maintenance':
        return '#FF7D00';
      case 'disabled':
        return '#F53F3F';
      default:
        return '#86909C';
    }
  };

  const renderRamp = () => {
    if (facility.path.length < 2) return null;
    const start = facility.path[0];
    const end = facility.path[facility.path.length - 1];
    const midPoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
      z: (start.z + end.z) / 2,
    };
    const length = Math.sqrt(
      Math.pow(end.x - start.x, 2) + Math.pow(end.z - start.z, 2)
    );
    const angle = Math.atan2(end.x - start.x, end.z - start.z);

    return (
      <group position={[midPoint.x, midPoint.y, midPoint.z]} rotation={[0, angle, 0]}>
        <mesh
          rotation={[Math.atan2(end.y - start.y, length), 0, 0]}
          onClick={handleClick}
        >
          <boxGeometry args={[2, 0.1, length + 0.5]} />
          <meshStandardMaterial
            color={getStatusColor()}
            emissive={getStatusColor()}
            emissiveIntensity={0.2}
          />
        </mesh>
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.5, 8]} />
          <meshStandardMaterial color={getStatusColor()} emissive={getStatusColor()} emissiveIntensity={0.5} />
        </mesh>
      </group>
    );
  };

  const renderElevator = () => {
    const floors = facility.floor || 3;
    const height = floors * 3;

    return (
      <group position={[facility.position.x, facility.position.y, facility.position.z]} onClick={handleClick}>
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[3, height + 0.5, 3]} />
          <meshStandardMaterial color="#4E5969" transparent opacity={0.3} />
        </mesh>

        {Array.from({ length: floors + 1 }).map((_, i) => (
          <mesh key={i} position={[0, i * 3, 0]}>
            <boxGeometry args={[3.5, 0.2, 3.5]} />
            <meshStandardMaterial
              color={getStatusColor()}
              emissive={getStatusColor()}
              emissiveIntensity={i === 0 ? 0.5 : 0.2}
            />
          </mesh>
        ))}

        <mesh position={[0, -0.2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.2, 1.5, 32]} />
          <meshBasicMaterial color={getStatusColor()} transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  };

  const renderPath = () => {
    if (facility.path.length < 2) return null;

    const points = facility.path.map(
      (p) => new THREE.Vector3(p.x, p.y + 0.05, p.z)
    );
    const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

    return (
      <group onClick={handleClick}>
        <line>
          <bufferGeometry attach="geometry" {...lineGeometry} />
          <lineBasicMaterial attach="material" color="#165DFF" linewidth={2} />
        </line>
        {facility.path.map((point, i) => (
          <mesh key={i} position={[point.x, point.y + 0.2, point.z]}>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshBasicMaterial color="#165DFF" />
          </mesh>
        ))}
      </group>
    );
  };

  return (
    <group ref={meshRef}>
      {facility.type === 'ramp' && renderRamp()}
      {facility.type === 'elevator' && renderElevator()}
      {(facility.type === 'path' || facility.type === 'doorway') && renderPath()}
    </group>
  );
};
