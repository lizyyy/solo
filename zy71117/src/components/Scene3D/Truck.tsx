import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { VehicleParams, PathPoint } from '../../types';

interface TruckProps {
  vehicle: VehicleParams;
  position?: [number, number, number];
  rotation?: [number, number, number];
  isAnimating?: boolean;
  path?: PathPoint[];
  progress?: number;
  showCollision?: boolean;
}

export function Truck({
  vehicle,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  isAnimating = false,
  path = [],
  progress = 0,
  showCollision = false,
}: TruckProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (isAnimating && path.length > 0 && groupRef.current) {
      const index = Math.floor(progress * (path.length - 1));
      const point = path[Math.min(index, path.length - 1)];
      if (point) {
        groupRef.current.position.set(
          point.position.x,
          vehicle.height / 2,
          point.position.z
        );
        groupRef.current.rotation.y = point.rotation;
      }
    }
  });

  const bodyColor = showCollision ? '#F53F3F' : '#165DFF';
  const cabinColor = showCollision ? '#F53F3F' : '#0E42D2';

  return (
    <group
      ref={groupRef}
      position={isAnimating ? undefined : position}
      rotation={isAnimating ? undefined : rotation}
    >
      <mesh position={[0, vehicle.height / 2, -vehicle.length / 4]}>
        <boxGeometry
          args={[vehicle.width, vehicle.height * 0.7, vehicle.length * 0.6]}
        />
        <meshStandardMaterial color={bodyColor} metalness={0.3} roughness={0.5} />
      </mesh>

      <mesh position={[0, vehicle.height * 0.6, vehicle.length / 3]}>
        <boxGeometry
          args={[vehicle.width * 0.95, vehicle.height * 0.8, vehicle.length * 0.25]}
        />
        <meshStandardMaterial color={cabinColor} metalness={0.4} roughness={0.4} />
      </mesh>

      <mesh position={[0, vehicle.height * 0.9, vehicle.length / 3]}>
        <boxGeometry
          args={[vehicle.width * 0.8, vehicle.height * 0.35, vehicle.length * 0.2]}
        />
        <meshStandardMaterial color="#1D2129" metalness={0.5} roughness={0.3} />
      </mesh>

      {[-vehicle.width / 2.5, vehicle.width / 2.5].map((x) =>
        [-vehicle.length / 3, vehicle.length / 3].map((z, i) => (
          <mesh key={`wheel-${x}-${z}`} position={[x, 0.4, z]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.45, 0.45, 0.3, 16]} />
            <meshStandardMaterial color="#1D2129" metalness={0.6} roughness={0.3} />
          </mesh>
        ))
      )}

      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[vehicle.width * 0.9, 0.2, vehicle.length * 0.95]} />
        <meshStandardMaterial color="#2A2A2A" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}
