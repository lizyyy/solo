import React from 'react';

interface OperatingRoomProps {
  width: number;
  depth: number;
}

export const OperatingRoom: React.FC<OperatingRoomProps> = ({ width, depth }) => {
  const wallHeight = 3;
  const wallThickness = 0.2;

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#f5f5f5" />
      </mesh>

      <mesh position={[0, wallHeight / 2, -depth / 2 - wallThickness / 2]} castShadow>
        <boxGeometry args={[width, wallHeight, wallThickness]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>

      <mesh position={[0, wallHeight / 2, depth / 2 + wallThickness / 2]} castShadow>
        <boxGeometry args={[width, wallHeight, wallThickness]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>

      <mesh position={[-width / 2 - wallThickness / 2, wallHeight / 2, 0]} castShadow>
        <boxGeometry args={[wallThickness, wallHeight, depth]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>

      <mesh position={[width / 2 + wallThickness / 2, wallHeight / 2, 0]} castShadow>
        <boxGeometry args={[wallThickness, wallHeight, depth]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>

      <gridHelper args={[Math.max(width, depth), Math.max(width, depth), '#cccccc', '#e5e5e5']} position={[0, 0.001, 0]} />
    </group>
  );
};
