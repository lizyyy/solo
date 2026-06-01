import React from 'react';

interface CoordinateAxesProps {
  visible: boolean;
}

export const CoordinateAxes: React.FC<CoordinateAxesProps> = ({ visible }) => {
  if (!visible) return null;

  return (
    <group position={[-18, 0.1, -18]}>
      <mesh position={[1, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
        <meshBasicMaterial color="#EF4444" />
      </mesh>
      <mesh position={[2, 0, 0]}>
        <coneGeometry args={[0.15, 0.3, 8]} />
        <meshBasicMaterial color="#EF4444" />
      </mesh>

      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
        <meshBasicMaterial color="#10B981" />
      </mesh>
      <mesh position={[0, 2, 0]} rotation={[0, 0, Math.PI]}>
        <coneGeometry args={[0.15, 0.3, 8]} />
        <meshBasicMaterial color="#10B981" />
      </mesh>

      <mesh position={[0, 0, 1]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
        <meshBasicMaterial color="#3B82F6" />
      </mesh>
      <mesh position={[0, 0, 2]}>
        <coneGeometry args={[0.15, 0.3, 8]} />
        <meshBasicMaterial color="#3B82F6" />
      </mesh>
    </group>
  );
};
