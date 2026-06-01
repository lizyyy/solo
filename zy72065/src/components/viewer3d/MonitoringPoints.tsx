import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { MonitoringPoint } from '../../types';
import { getStatusColor } from '../../utils/terrain';
import { useStore } from '../../store/useStore';

interface SinglePointProps {
  point: MonitoringPoint;
  isSelected: boolean;
  onClick: () => void;
}

function SinglePoint({ point, isSelected, onClick }: SinglePointProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const baseRadius = point.status === 'danger' ? 0.8 : point.status === 'warning' ? 0.6 : 0.4;
  const color = getStatusColor(point.status);
  const emissiveIntensity =
    point.status === 'danger' ? 0.8 : point.status === 'warning' ? 0.5 : 0.2;

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.elapsedTime;
    let scale = 1;

    if (point.status === 'warning' || point.status === 'danger') {
      const speed = point.status === 'danger' ? 3 : 2;
      scale = 1 + Math.sin(time * speed) * 0.15;
    }

    if (isSelected) {
      scale *= 1.5;
    } else if (hovered) {
      scale *= 1.2;
    }

    meshRef.current.scale.setScalar(baseRadius * scale);
  });

  return (
    <Sphere
      ref={meshRef}
      args={[1, 16, 16]}
      position={[point.coordinates.x, point.coordinates.y + baseRadius, point.coordinates.z]}
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
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
      />
    </Sphere>
  );
}

interface MonitoringPointsProps {
  points: MonitoringPoint[];
  onPointClick: (pointId: string) => void;
}

export function MonitoringPoints({ points, onPointClick }: MonitoringPointsProps) {
  const selectedPointId = useStore((state) => state.selectedPointId);

  const sortedPoints = [...points].sort((a, b) => {
    const priority = { danger: 0, warning: 1, normal: 2 };
    return priority[a.status] - priority[b.status];
  });

  return (
    <group>
      {sortedPoints.map((point) => (
        <SinglePoint
          key={point.id}
          point={point}
          isSelected={point.id === selectedPointId}
          onClick={() => onPointClick(point.id)}
        />
      ))}
    </group>
  );
}
