import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import { TrajectoryPoint, StoneColor } from '../../types';

interface TrajectoryLineProps {
  points: TrajectoryPoint[];
  color: StoneColor;
  opacity?: number;
}

export const TrajectoryLine: React.FC<TrajectoryLineProps> = ({
  points,
  color,
  opacity = 0.6
}) => {
  const lineColor = color === 'red' ? '#ff6b6b' : '#ffd93d';
  
  const linePoints = useMemo(() => {
    return points.map(p => [p.position.x, 0.02, p.position.y] as [number, number, number]);
  }, [points]);

  if (points.length < 2) return null;

  return (
    <group>
      <Line 
        points={linePoints}
        color={lineColor}
        lineWidth={2}
        transparent
        opacity={opacity}
      />
      
      {points.filter((_, i) => i % 50 === 0).map((point, idx) => (
        <mesh 
          key={`marker-${idx}`}
          position={[point.position.x, 0.03, point.position.y]}
        >
          <sphereGeometry args={[0.02, 8, 8]} />
          <meshBasicMaterial color={lineColor} transparent opacity={opacity * 0.8} />
        </mesh>
      ))}
    </group>
  );
};
