import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { LightPoint, PointStatus } from '../../types';

interface LightFixtureProps {
  point: LightPoint;
  isSelected: boolean;
  onClick: () => void;
}

const getStatusColor = (status: PointStatus): string => {
  switch (status) {
    case 'normal':
      return '#10b981';
    case 'pending':
      return '#f59e0b';
    case 'abnormal':
      return '#ef4444';
    default:
      return '#6b7280';
  }
};

export const LightFixture = ({ point, isSelected, onClick }: LightFixtureProps) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current && (isSelected || hovered)) {
      meshRef.current.scale.setScalar(1 + Math.sin(state.clock.elapsedTime * 4) * 0.05);
    } else if (meshRef.current) {
      meshRef.current.scale.setScalar(1);
    }
  });

  const color = getStatusColor(point.status);
  const scale = isSelected ? 1.2 : 1;

  return (
    <group position={[point.x, point.z, point.y]} onClick={onClick}>
      <mesh
        ref={meshRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
        scale={scale}
      >
        <boxGeometry args={[0.8, 0.8, 0.8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.5 : hovered ? 0.3 : 0.1}
          transparent
          opacity={0.9}
        />
      </mesh>

      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 1.2, 8]} />
        <meshStandardMaterial color="#4a5568" />
      </mesh>

      <mesh position={[0, 0.6, 0]}>
        <coneGeometry args={[0.3, 0.5, 8]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          transparent
          opacity={0.8}
        />
      </mesh>

      {(isSelected || hovered) && (
        <mesh position={[0, 1.2, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}

      {point.status === 'abnormal' && (
        <mesh position={[0.6, 0.6, 0]}>
          <ringGeometry args={[0.15, 0.25, 8]} />
          <meshBasicMaterial color="#ef4444" side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
};
