import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import type { PathPoint, Vector3 } from '../../types';
import { generateSmoothPathPoints } from '../../utils/pathUtils';

interface PathLineProps {
  path: PathPoint[];
  color: string;
  hasError: boolean;
  currentTime: number;
}

export const PathLine: React.FC<PathLineProps> = ({
  path,
  color,
  hasError,
  currentTime,
}) => {
  const linePoints = useMemo(() => {
    if (path.length < 2) return [];
    return generateSmoothPathPoints(path, 30);
  }, [path]);

  const threePoints = useMemo(() => {
    return linePoints.map((p) => [p.x, p.y + 0.05, p.z] as [number, number, number]);
  }, [linePoints]);

  const lineColor = hasError ? '#F53F3F' : color;

  if (path.length < 2) return null;

  return (
    <group>
      <Line
        points={threePoints}
        color={lineColor}
        lineWidth={3}
        transparent
        opacity={hasError ? 0.9 : 0.7}
        dashed={hasError}
        dashSize={0.2}
        gapSize={0.1}
      />

      {path.map((point, index) => (
        <group key={point.id} position={[point.position.x, 0.1, point.position.z]}>
          <mesh>
            <sphereGeometry args={[0.08, 16, 16]} />
            <meshBasicMaterial color={lineColor} />
          </mesh>
          <mesh position={[0, 0.15, 0]}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </group>
  );
};
