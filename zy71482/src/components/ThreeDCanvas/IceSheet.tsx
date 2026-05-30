import React from 'react';
import { ICE_SHEET_WIDTH, ICE_SHEET_LENGTH } from '../../types';

export const IceSheet: React.FC = () => {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
        <planeGeometry args={[ICE_SHEET_WIDTH + 2, ICE_SHEET_LENGTH + 2]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>
      
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[ICE_SHEET_WIDTH, ICE_SHEET_LENGTH]} />
        <meshStandardMaterial 
          color="#e8f4ff" 
          transparent 
          opacity={0.9}
          roughness={0.1}
          metalness={0.1}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
        <planeGeometry args={[ICE_SHEET_WIDTH - 0.5, ICE_SHEET_LENGTH - 0.5]} />
        <meshBasicMaterial 
          color="#ffffff" 
          transparent 
          opacity={0.08}
          side={2}
        />
      </mesh>

      <group position={[0, 0.002, ICE_SHEET_LENGTH / 2 - 3.6]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.61, 1.22, 64]} />
          <meshBasicMaterial color="#0066cc" side={2} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0, 0.61, 64]} />
          <meshBasicMaterial color="#ffffff" side={2} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.15, 0.155, 64]} />
          <meshBasicMaterial color="#cc0000" side={2} />
        </mesh>
      </group>

      <group position={[0, 0.002, -ICE_SHEET_LENGTH / 2 + 3.6]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.61, 1.22, 64]} />
          <meshBasicMaterial color="#0066cc" side={2} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0, 0.61, 64]} />
          <meshBasicMaterial color="#ffffff" side={2} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.15, 0.155, 64]} />
          <meshBasicMaterial color="#cc0000" side={2} />
        </mesh>
      </group>

      <group>
        {[-1, 1].map(side => (
          <mesh 
            key={`side-${side}`}
            position={[side * (ICE_SHEET_WIDTH / 2 + 0.05), 0.1, 0]}
          >
            <boxGeometry args={[0.1, 0.2, ICE_SHEET_LENGTH]} />
            <meshStandardMaterial color="#2d3748" />
          </mesh>
        ))}
        {[-1, 1].map(side => (
          <mesh 
            key={`end-${side}`}
            position={[0, 0.1, side * (ICE_SHEET_LENGTH / 2 + 0.05)]}
          >
            <boxGeometry args={[ICE_SHEET_WIDTH + 0.3, 0.2, 0.1]} />
            <meshStandardMaterial color="#2d3748" />
          </mesh>
        ))}
      </group>

      <group position={[0, 0.002, 0]}>
        {[-1, 1].map(side => (
          <mesh key={`center-${side}`} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.02, ICE_SHEET_LENGTH]} />
            <meshBasicMaterial color="#0066cc" transparent opacity={0.3} />
          </mesh>
        ))}
      </group>
    </group>
  );
};
