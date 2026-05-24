import { useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { FallPoint } from '../../types';
import { getRiskLevelColor } from '../../utils/dataValidator';

interface FallPointMarkerProps {
  fallPoint: FallPoint;
  isSelected: boolean;
  onClick: () => void;
  terrainHeightmap?: number[][];
  terrainScale?: number;
}

export function FallPointMarker({
  fallPoint,
  isSelected,
  onClick,
  terrainHeightmap,
  terrainScale = 1
}: FallPointMarkerProps) {
  const groupRef = useRef<THREE.Group>(null);
  const [hovered, setHovered] = useState(false);

  const position = useMemo(() => {
    let height = 0;
    if (terrainHeightmap && terrainHeightmap.length > 0) {
      const xIdx = Math.floor(fallPoint.position.x / 2);
      const zIdx = Math.floor(fallPoint.position.z / 2);
      if (terrainHeightmap[zIdx] && terrainHeightmap[zIdx][xIdx] !== undefined) {
        height = terrainHeightmap[zIdx][xIdx] * terrainScale * 0.5;
      }
    }
    return new THREE.Vector3(fallPoint.position.x, height + 2, fallPoint.position.z);
  }, [fallPoint.position, terrainHeightmap, terrainScale]);

  const color = getRiskLevelColor(fallPoint.severity);
  const scale = isSelected || hovered ? 1.3 : 1;

  useFrame((state) => {
    if (groupRef.current) {
      const time = state.clock.elapsedTime;
      groupRef.current.position.y = position.y + Math.sin(time * 2) * 0.5;
      groupRef.current.scale.setScalar(scale);
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'default';
      }}
    >
      <mesh>
        <coneGeometry args={[1.5, 4, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isSelected ? 0.5 : 0.2}
          transparent
          opacity={0.9}
        />
      </mesh>
      
      <mesh position={[0, -2, 0]}>
        <cylinderGeometry args={[2, 2, 0.2, 16]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.5}
        />
      </mesh>

      {isSelected && (
        <mesh position={[0, 0, 0]}>
          <ringGeometry args={[2.5, 3, 32]} />
          <meshBasicMaterial color={color} side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

export default FallPointMarker;
