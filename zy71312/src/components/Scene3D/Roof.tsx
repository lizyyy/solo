import React from 'react';

interface RoofProps {
  angle: number;
  width?: number;
  depth?: number;
}

export const Roof: React.FC<RoofProps> = ({ angle, width = 10, depth = 8 }) => {
  const angleRad = (angle * Math.PI) / 180;
  const roofHeight = Math.tan(angleRad) * (depth / 2);

  return (
    <group>
      <mesh position={[0, -0.5, 0]} receiveShadow>
        <boxGeometry args={[width + 2, 1, depth + 4]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>

      <mesh position={[0, 0, 0]} receiveShadow castShadow>
        <boxGeometry args={[width, 0.3, depth]} />
        <meshStandardMaterial color="#A0522D" />
      </mesh>

      <mesh
        position={[0, roofHeight / 2 + 0.15, 0]}
        rotation={[angleRad, 0, 0]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width - 0.5, 0.1, depth / Math.cos(angleRad)]} />
        <meshStandardMaterial color="#4A4A4A" />
      </mesh>

      <gridHelper args={[width, 10, '#666666', '#444444']} position={[0, 0.01, 0]} />
    </group>
  );
};
