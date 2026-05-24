
import React from 'react';
import { GantryRail } from '../../types';

interface Rail3DProps {
  rail: GantryRail;
}

export const Rail3D: React.FC<Rail3DProps> = ({ rail }) => {
  const length = Math.sqrt(
    Math.pow(rail.end.x - rail.start.x, 2) +
    Math.pow(rail.end.z - rail.start.z, 2)
  );
  const centerX = (rail.start.x + rail.end.x) / 2;
  const centerZ = (rail.start.z + rail.end.z) / 2;
  const angle = Math.atan2(rail.end.z - rail.start.z, rail.end.x - rail.start.x);

  return (
    <group position={[centerX, 0.1, centerZ]} rotation={[0, -angle, 0]}>
      <mesh receiveShadow>
        <boxGeometry args={[length, 0.3, rail.width]} />
        <meshStandardMaterial color="#4A4A4A" metalness={0.8} roughness={0.3} />
      </mesh>

      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[length, 0.1, rail.width * 0.8]} />
        <meshStandardMaterial color="#2A2A2A" metalness={0.9} roughness={0.2} />
      </mesh>

      {Array.from({ length: Math.floor(length / 3) + 1 }).map((_, i) => (
        <mesh key={i} position={[-length / 2 + i * 3, 0.15, 0]}>
          <cylinderGeometry args={[0.05, 0.05, 0.4, 8]} />
          <meshStandardMaterial color="#1A1A1A" />
        </mesh>
      ))}
    </group>
  );
};

