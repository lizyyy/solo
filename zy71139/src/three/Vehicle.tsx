import React from 'react';
import { Vehicle as VehicleType } from '../types';

interface VehicleProps {
  vehicle: VehicleType;
}

export const Vehicle: React.FC<VehicleProps> = ({ vehicle }) => {
  const rotationY = vehicle.direction > 0 ? 0 : Math.PI;

  return (
    <group 
      position={[vehicle.position.x, vehicle.position.y, vehicle.position.z]} 
      rotation={[0, rotationY, 0]}
    >
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[3.5, 0.8, 1.6]} />
        <meshStandardMaterial color="#1e3a5f" metalness={0.6} roughness={0.4} />
      </mesh>

      <mesh position={[-0.3, 1.1, 0]} castShadow>
        <boxGeometry args={[1.8, 0.8, 1.4]} />
        <meshStandardMaterial color="#1e3a5f" metalness={0.6} roughness={0.4} />
      </mesh>

      <mesh position={[-0.3, 1.1, 0.01]}>
        <boxGeometry args={[1.6, 0.6, 1.35]} />
        <meshStandardMaterial color="#87ceeb" transparent opacity={0.4} />
      </mesh>

      <mesh position={[-1.6, 0.4, 0.8]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color="#fef3c7" />
      </mesh>
      <mesh position={[-1.6, 0.4, -0.8]}>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshBasicMaterial color="#fef3c7" />
      </mesh>

      <mesh position={[1.6, 0.4, 0.8]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
      <mesh position={[1.6, 0.4, -0.8]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>

      {[0.7, -0.7].map((zOffset) => (
        <React.Fragment key={`wheel-${zOffset}`}>
          <mesh position={[-1, 0, zOffset]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.2, 16]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.8} />
          </mesh>
          <mesh position={[1, 0, zOffset]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.35, 0.35, 0.2, 16]} />
            <meshStandardMaterial color="#1a1a1a" metalness={0.3} roughness={0.8} />
          </mesh>
        </React.Fragment>
      ))}

      <group position={[2.5, 0.3, 0]} rotation={[0, 0, 0]}>
        <mesh>
          <coneGeometry args={[0.3, 0.8, 8]} />
          <meshBasicMaterial color="#fbbf24" transparent opacity={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
          <meshBasicMaterial color="#fbbf24" />
        </mesh>
      </group>
    </group>
  );
};
