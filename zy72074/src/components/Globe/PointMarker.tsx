import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Point } from '../../types';
import { STATUS_COLORS, ANOMALY_COLOR } from '../../types';
import { latLngToVector3, EARTH_RADIUS } from '../../utils/coordinate';

interface PointMarkerProps {
  point: Point;
  isSelected: boolean;
  onClick: (point: Point) => void;
}

export function PointMarker({ point, isSelected, onClick }: PointMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const position = latLngToVector3(point.lat, point.lng, EARTH_RADIUS * 1.01);
  const normal = position.clone().normalize();
  
  const baseColor = point.isAnomaly ? ANOMALY_COLOR : STATUS_COLORS[point.status];
  const color = hovered || isSelected ? '#ffffff' : baseColor;
  const scale = hovered || isSelected ? 1.3 : 1;

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    if (meshRef.current) {
      meshRef.current.scale.setScalar(scale);
      
      if (point.isAnomaly) {
        const pulse = 1 + Math.sin(time * 3) * 0.2;
        meshRef.current.scale.setScalar(scale * pulse);
      }
    }
    
    if (ringRef.current && point.isAnomaly) {
      const pulseScale = 1 + (time % 1.5) * 0.5;
      ringRef.current.scale.setScalar(pulseScale);
      const material = ringRef.current.material as THREE.MeshBasicMaterial;
      material.opacity = Math.max(0, 0.6 - (time % 1.5) * 0.4);
    }
  });

  const handleClick = (e: any) => {
    e.stopPropagation();
    onClick(point);
  };

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (e: any) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'default';
  };

  return (
    <group position={position} lookAt={normal.clone().multiplyScalar(2) as any}>
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <sphereGeometry args={[0.04, 16, 16]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {point.isAnomaly && (
        <mesh ref={ringRef}>
          <ringGeometry args={[0.05, 0.06, 32]} />
          <meshBasicMaterial
            color={ANOMALY_COLOR}
            transparent
            opacity={0.6}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {isSelected && (
        <mesh>
          <ringGeometry args={[0.07, 0.08, 32]} />
          <meshBasicMaterial
            color="#3b82f6"
            transparent
            opacity={0.8}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
    </group>
  );
}
