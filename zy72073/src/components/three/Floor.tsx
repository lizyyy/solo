import React from 'react';

interface FloorProps {
  floor: number;
  y: number;
  visible: boolean;
}

export const Floor: React.FC<FloorProps> = ({ y, visible }) => {
  if (!visible) return null;

  return (
    <group position={[0, y, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[50, 50]} />
        <meshStandardMaterial color="#0a0f1a" />
      </mesh>
      <gridHelper args={[40, 40, '#1e3a5f', '#0f2540']} position={[0, 0.01, 0]} />
      <mesh position={[0, 0.1, -20.5]}>
        <boxGeometry args={[2, 0.4, 0.2]} />
        <meshStandardMaterial color="#06B6D4" emissive="#06B6D4" emissiveIntensity={0.3} />
      </mesh>
    </group>
  );
};
