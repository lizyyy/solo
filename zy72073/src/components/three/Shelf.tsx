import React from 'react';

interface ShelfProps {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  name: string;
  visible: boolean;
}

export const Shelf: React.FC<ShelfProps> = ({ x, y, z, width, depth, height, visible }) => {
  if (!visible) return null;

  return (
    <group position={[x, y, z]}>
      <mesh position={[0, height / 2, 0]}>
        <boxGeometry args={[width, 0.1, depth]} />
        <meshStandardMaterial color="#1e3a5f" transparent opacity={0.6} />
      </mesh>
      {[0.25, 0.5, 0.75].map((ratio, i) => (
        <mesh key={i} position={[0, height * ratio, 0]}>
          <boxGeometry args={[width, 0.05, depth]} />
          <meshStandardMaterial color="#2d4a6f" transparent opacity={0.5} />
        </mesh>
      ))}
      <mesh position={[-width / 2, height / 2, 0]}>
        <boxGeometry args={[0.1, height, depth]} />
        <meshStandardMaterial color="#3d5a7f" transparent opacity={0.4} />
      </mesh>
      <mesh position={[width / 2, height / 2, 0]}>
        <boxGeometry args={[0.1, height, depth]} />
        <meshStandardMaterial color="#3d5a7f" transparent opacity={0.4} />
      </mesh>
    </group>
  );
};
