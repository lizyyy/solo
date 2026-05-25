import React, { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { CrackPoint, STATUS_COLORS } from '../../types';
import { Html } from '@react-three/drei';

interface CrackPointsProps {
  cracks: CrackPoint[];
  selectedCrackId: string | null;
  onCrackSelect: (crackId: string | null) => void;
  onPositionChange?: (crackId: string, position: { x: number; y: number; z: number }) => void;
}

export const CrackPoints: React.FC<CrackPointsProps> = ({
  cracks,
  selectedCrackId,
  onCrackSelect,
  onPositionChange,
}) => {
  return (
    <group>
      {cracks.map((crack) => (
        <CrackMarker
          key={crack.id}
          crack={crack}
          isSelected={selectedCrackId === crack.id}
          onSelect={() => onCrackSelect(crack.id)}
          onPositionChange={onPositionChange}
        />
      ))}
    </group>
  );
};

interface CrackMarkerProps {
  crack: CrackPoint;
  isSelected: boolean;
  onSelect: () => void;
  onPositionChange?: (crackId: string, position: { x: number; y: number; z: number }) => void;
}

const CrackMarker: React.FC<CrackMarkerProps> = ({
  crack,
  isSelected,
  onSelect,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const color = STATUS_COLORS[crack.status];

  useFrame((state) => {
    if (meshRef.current) {
      const scale = isSelected ? 1.3 : hovered ? 1.15 : 1;
      meshRef.current.scale.setScalar(scale);
      const pulse = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.05;
      meshRef.current.scale.multiplyScalar(pulse);
    }
  });

  const handleClick = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    onSelect();
  };

  const handlePointerOver = (e: { stopPropagation: () => void }) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = () => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  const basePosition = new THREE.Vector3(crack.position.x, crack.position.y, crack.position.z);

  return (
    <group position={basePosition}>
      {crack.endPosition && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([
                0, 0, 0,
                crack.endPosition.x - crack.position.x,
                crack.endPosition.y - crack.position.y,
                crack.endPosition.z - crack.position.z,
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={color} linewidth={isSelected ? 4 : 2} />
        </line>
      )}

      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.8 : hovered ? 0.5 : 0.3}
          transparent
          opacity={0.9}
        />
      </mesh>

      <mesh position={[0, 0.15, 0]}>
        <ringGeometry args={[0.15, 0.18, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {(hovered || isSelected) && (
        <Html position={[0.3, 0.3, 0]} center distanceFactor={8}>
          <div
            className="px-2 py-1.5 rounded text-xs whitespace-nowrap"
            style={{
              background: 'rgba(26, 32, 44, 0.95)',
              border: `1px solid ${color}`,
              color: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            }}
          >
            <div className="font-bold" style={{ color }}>{crack.id}</div>
            <div className="text-gray-300 text-[10px] mt-0.5">
              长度: {crack.length.toFixed(2)}m | 宽度: {crack.width.toFixed(1)}mm
            </div>
          </div>
        </Html>
      )}
    </group>
  );
};
