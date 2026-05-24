import React from 'react';

interface TunnelProps {
  length: number;
}

export const Tunnel: React.FC<TunnelProps> = ({ length }) => {
  const halfLength = length / 2;
  const width = 12;
  const height = 6;
  const wallThickness = 0.5;

  return (
    <group>
      <mesh position={[0, -0.25, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[length + 10, width + 4]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
      </mesh>

      <mesh position={[0, height / 2, -width / 2 - wallThickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[length, height, wallThickness]} />
        <meshStandardMaterial color="#3d3d3d" roughness={0.8} />
      </mesh>

      <mesh position={[0, height / 2, width / 2 + wallThickness / 2]} castShadow receiveShadow>
        <boxGeometry args={[length, height, wallThickness]} />
        <meshStandardMaterial color="#3d3d3d" roughness={0.8} />
      </mesh>

      <mesh position={[0, height + wallThickness / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[length, wallThickness, width + wallThickness * 2]} />
        <meshStandardMaterial color="#4a4a4a" roughness={0.7} />
      </mesh>

      {Array.from({ length: Math.floor(length / 15) }).map((_, i) => {
        const xPos = -halfLength + i * 15 + 7.5;
        return (
          <group key={i} position={[xPos, height - 0.5, 0]}>
            <pointLight intensity={0.8} distance={20} color="#fff5e6" castShadow />
            <mesh position={[0, 0, 0]}>
              <sphereGeometry args={[0.15, 8, 8]} />
              <meshBasicMaterial color="#fff5e6" />
            </mesh>
          </group>
        );
      })}

      {Array.from({ length: Math.floor(length / 20) + 1 }).map((_, i) => {
        const xPos = -halfLength + i * 20;
        return (
          <group key={`sign-${i}`} position={[xPos, height - 1.5, width / 2 + 0.6]}>
            <mesh>
              <boxGeometry args={[3, 0.8, 0.1]} />
              <meshBasicMaterial color="#1a5f2a" />
            </mesh>
          </group>
        );
      })}

      <mesh position={[-halfLength - 0.5, height / 2, 0]}>
        <boxGeometry args={[1, height + 1, width + 1]} />
        <meshStandardMaterial color="#1a1a1a" side={2} />
      </mesh>

      <mesh position={[halfLength + 0.5, height / 2, 0]}>
        <boxGeometry args={[1, height + 1, width + 1]} />
        <meshStandardMaterial color="#1a1a1a" side={2} />
      </mesh>

      <group position={[0, 0.02, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[length, width]} />
          <meshStandardMaterial color="#1e1e1e" />
        </mesh>
        
        {Array.from({ length: Math.floor(length / 5) }).map((_, i) => {
          const xPos = -halfLength + i * 5 + 2.5;
          return (
            <mesh 
              key={`line-${i}`} 
              position={[xPos, 0.03, 0]} 
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[4, 0.15]} />
              <meshBasicMaterial color="#f0f0f0" />
            </mesh>
          );
        })}
      </group>
    </group>
  );
};
