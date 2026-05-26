import { useMemo, useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { ConveyorSegment } from '@/types/game';

interface ConveyorBeltProps {
  segment: ConveyorSegment;
}

export const ConveyorBelt = ({ segment }: ConveyorBeltProps) => {
  const beltRef = useRef<THREE.Mesh>(null);
  const textureRef = useRef<THREE.MeshStandardMaterial>(null);

  const { position, rotation, length, width } = useMemo(() => {
    const dx = segment.end.x - segment.start.x;
    const dz = segment.end.z - segment.start.z;
    const length = Math.sqrt(dx * dx + dz * dz);
    const width = 1.2;
    
    const midX = (segment.start.x + segment.end.x) / 2;
    const midZ = (segment.start.z + segment.end.z) / 2;
    
    const angle = Math.atan2(dx, dz);
    
    return {
      position: [midX, 0.15, midZ] as [number, number, number],
      rotation: [0, angle, 0] as [number, number, number],
      length,
      width,
    };
  }, [segment]);

  useFrame((_, delta) => {
    if (textureRef.current) {
      textureRef.current.emissiveIntensity = 0.1 + Math.sin(Date.now() * 0.005) * 0.05;
    }
  });

  const isSwitch = segment.isSwitch;
  const baseColor = isSwitch ? '#F59E0B' : '#4B5563';
  const highlightColor = isSwitch ? '#FBBF24' : '#6B7280';

  return (
    <group>
      <mesh position={position} rotation={rotation} castShadow receiveShadow>
        <boxGeometry args={[width, 0.15, length]} />
        <meshStandardMaterial 
          ref={textureRef}
          color={baseColor}
          metalness={0.3}
          roughness={0.5}
          emissive={highlightColor}
          emissiveIntensity={0.1}
        />
      </mesh>

      {Array.from({ length: Math.ceil(length / 0.8) }).map((_, i) => (
        <mesh
          key={i}
          position={[
            position[0] - Math.sin(rotation[1]) * (-length / 2 + i * 0.8 + 0.4),
            position[1] + 0.08,
            position[2] - Math.cos(rotation[1]) * (-length / 2 + i * 0.8 + 0.4),
          ]}
          rotation={rotation}
        >
          <boxGeometry args={[width - 0.1, 0.02, 0.3]} />
          <meshStandardMaterial color="#1F2937" metalness={0.8} roughness={0.2} />
        </mesh>
      ))}

      <mesh position={[position[0], 0.05, position[2]]} rotation={rotation}>
        <boxGeometry args={[width + 0.2, 0.1, length + 0.2]} />
        <meshStandardMaterial color="#374151" metalness={0.2} roughness={0.8} />
      </mesh>

      {isSwitch && (
        <mesh position={[position[0], 0.5, position[2]]}>
          <cylinderGeometry args={[0.15, 0.15, 0.6, 8]} />
          <meshStandardMaterial 
            color="#EF4444" 
            emissive="#EF4444" 
            emissiveIntensity={0.5}
          />
        </mesh>
      )}
    </group>
  );
};
