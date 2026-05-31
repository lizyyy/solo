import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import * as THREE from 'three';
import { RouteData, Coordinate } from '../../types';
import { coordToVector3, getCenterCoordinate } from '../../utils/geo';

interface RouteLineProps {
  route: RouteData;
  center: Coordinate;
  color?: string;
  opacity?: number;
  selected?: boolean;
  onClick?: () => void;
  showPoints?: boolean;
  animate?: boolean;
}

export function RouteLine({
  route,
  center,
  color = '#F97316',
  opacity = 1,
  selected = false,
  onClick,
  showPoints = true,
  animate = true,
}: RouteLineProps) {
  const points = useMemo(() => {
    return route.coordinates.map((coord) => coordToVector3(coord, center, 500));
  }, [route.coordinates, center]);

  return (
    <group onClick={onClick}>
      <Line
        points={points}
        color={color}
        lineWidth={selected ? 4 : 2}
        transparent
        opacity={opacity}
      />
      <Line
        points={points}
        color={color}
        lineWidth={selected ? 8 : 4}
        transparent
        opacity={opacity * 0.3}
      />
      {showPoints &&
        points.map((point, index) => (
          <mesh key={index} position={point}>
            <sphereGeometry args={[selected ? 0.08 : 0.05, 8, 8]} />
            <meshBasicMaterial color={color} transparent opacity={opacity} />
          </mesh>
        ))}
    </group>
  );
}
