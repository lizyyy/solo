
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';

interface AppointmentStation3DProps {
  position: [number, number, number];
  isAvailable: boolean;
  isHighlighted: boolean;
  onClick?: () => void;
}

export function AppointmentStation3D({ position, isAvailable, isHighlighted, onClick }: AppointmentStation3DProps) {
  const groupRef = useRef<THREE.Group>(null);
  const signRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (signRef.current && isAvailable) {
      signRef.current.rotation.y += delta * 0.5;
    }

    if (groupRef.current && isHighlighted) {
      groupRef.current.position.y = position[1] + Math.sin(Date.now() * 0.003) * 0.03;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (onClick) onClick();
  };

  return (
    <group ref={groupRef} position={position} onClick={handleClick}>
      {/* Platform */}
      <mesh position={[0, 0.05, 0]} receiveShadow castShadow>
        <boxGeometry args={[2.5, 0.1, 2]} />
        <meshStandardMaterial color="#5D4037" roughness={0.9} />
      </mesh>

      {/* Roof */}
      <mesh position={[0, 1.8, 0]} castShadow>
        <boxGeometry args={[2.7, 0.08, 2.2]} />
        <meshStandardMaterial color="#FF9800" roughness={0.5} />
      </mesh>

      {/* Support Pillars */}
      {[[-1.1, 1, -0.85], [1.1, 1, -0.85], [-1.1, 1, 0.85], [1.1, 1, 0.85]].map((pos, i) => (
        <mesh key={i} position={pos as [number, number, number]} castShadow>
          <boxGeometry args={[0.08, 1.5, 0.08]} />
          <meshStandardMaterial color="#8D6E63" />
        </mesh>
      ))}

      {/* Sign Board */}
      <group position={[0, 2.2, 0]}>
        <mesh ref={signRef} castShadow>
          <boxGeometry args={[0.8, 0.5, 0.05]} />
          <meshStandardMaterial
            color={isAvailable ? '#4CAF50' : '#9E9E9E'}
            emissive={isAvailable ? '#4CAF50' : '#000000'}
            emissiveIntensity={isAvailable ? 0.3 : 0}
          />
        </mesh>
        {/* Sign Text Area */}
        <mesh position={[0, 0, 0.03]}>
          <planeGeometry args={[0.7, 0.4]} />
          <meshBasicMaterial color={isAvailable ? '#E8F5E9' : '#EEEEEE'} />
        </mesh>
      </group>

      {/* Schedule Display */}
      <mesh position={[0, 0.8, 0.91]}>
        <planeGeometry args={[1.5, 0.6]} />
        <meshStandardMaterial color="#FFF8E1" />
      </mesh>

      {/* Highlight */}
      {isHighlighted && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.3, 1.5, 32]} />
          <meshBasicMaterial
            color="#FF9800"
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Availability Indicator Light */}
      <mesh position={[0, 2.5, 0]}>
        <sphereGeometry args={[0.1, 16, 16]} />
        <meshBasicMaterial
          color={isAvailable ? '#76FF03' : '#FF5252'}
          transparent
          opacity={isAvailable ? 0.9 : 0.5}
        />
      </mesh>
    </group>
  );
}

export default AppointmentStation3D;
