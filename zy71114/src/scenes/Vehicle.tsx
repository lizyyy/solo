import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Vehicle as VehicleType, Vector3 } from '../types';

interface VehicleProps {
  vehicle: VehicleType;
  position: Vector3;
  rotation?: Vector3;
  showHeightIndicator?: boolean;
}

export function Vehicle({ vehicle, position, rotation = [0, 0, 0], showHeightIndicator = true }: VehicleProps) {
  const groupRef = useRef<THREE.Group>(null);
  const heightInMeters = vehicle.unit === 'cm' ? vehicle.height / 100 : vehicle.height;

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.set(position[0], position[1] + heightInMeters / 2, position[2]);
      groupRef.current.rotation.set(rotation[0], rotation[1], rotation[2]);
    }
  });

  const bodyColor = vehicle.type === 'truck' ? '#4A5568' : vehicle.type === 'van' ? '#2D3748' : '#1A365D';
  const wheelRadius = 0.35;

  return (
    <group ref={groupRef}>
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[vehicle.width, heightInMeters * 0.6, vehicle.length * 0.7]} />
        <meshStandardMaterial color={bodyColor} metalness={0.3} roughness={0.7} />
      </mesh>

      {vehicle.type === 'suv' && (
        <mesh position={[0, heightInMeters * 0.25, -vehicle.length * 0.1]} castShadow>
          <boxGeometry args={[vehicle.width * 0.9, heightInMeters * 0.5, vehicle.length * 0.45]} />
          <meshStandardMaterial color={bodyColor} metalness={0.3} roughness={0.7} />
        </mesh>
      )}

      {vehicle.type === 'truck' && (
        <mesh position={[0, heightInMeters * 0.1, vehicle.length * 0.15]} castShadow>
          <boxGeometry args={[vehicle.width, heightInMeters * 0.85, vehicle.length * 0.5]} />
          <meshStandardMaterial color="#E2E8F0" metalness={0.2} roughness={0.8} />
        </mesh>
      )}

      {[-1, 1].map((side) =>
        [-1, 1].map((dir) => (
          <mesh
            key={`wheel-${side}-${dir}`}
            position={[
              (side * vehicle.width) / 2 - side * 0.1,
              -heightInMeters * 0.3 + wheelRadius,
              (dir * vehicle.length * 0.25),
            ]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
          >
            <cylinderGeometry args={[wheelRadius, wheelRadius, 0.2, 16]} />
            <meshStandardMaterial color="#1A202C" metalness={0.1} roughness={0.9} />
          </mesh>
        ))
      )}

      {showHeightIndicator && (
        <group position={[0, 0, vehicle.length * 0.4]}>
          <mesh position={[0, heightInMeters / 2, 0]}>
            <cylinderGeometry args={[0.03, 0.03, heightInMeters, 8]} />
            <meshBasicMaterial color="#F53F3F" />
          </mesh>
          <mesh position={[0, heightInMeters, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.15, 0.15, 0.04, 8]} />
            <meshBasicMaterial color="#F53F3F" />
          </mesh>
        </group>
      )}
    </group>
  );
}
