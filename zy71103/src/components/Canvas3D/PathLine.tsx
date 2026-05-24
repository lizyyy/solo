import React, { useMemo } from 'react';
import { Line } from '@react-three/drei';
import type { PathPoint, Vector3 } from '../../types';
import { generateSmoothPathPoints } from '../../utils/pathUtils';

interface PathLineProps {
  path: PathPoint[];
  color: string;
  hasError: boolean;
  currentTime: number;
  isPlaying: boolean;
}

export const PathLine: React.FC<PathLineProps> = ({
  path,
  color,
  hasError,
  currentTime,
  isPlaying,
}) => {
  const linePoints = useMemo(() => {
    if (path.length < 2) return [];
    return generateSmoothPathPoints(path, 30);
  }, [path]);

  const activeLength = useMemo(() => {
    if (!isPlaying || path.length < 2) return 0;
    const totalDuration = path[path.length - 1].timestamp - path[0].timestamp;
    if (totalDuration === 0) return 0;
    const progress = (currentTime - path[0].timestamp) / totalDuration;
    return Math.max(0, Math.min(1, progress));
  }, [currentTime, path, isPlaying]);

  const lineColor = hasError ? '#F53F3F' : color;

  if (path.length < 2) return null;

  const threePoints = useMemo(() => {
    return linePoints.map((p) => [p.x, p.y + 0.05, p.z] as [number, number, number]);
  }, [linePoints]);

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

      {isPlaying && activeLength > 0 && (
        <mesh position={getActivePosition(linePoints, activeLength)}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}
    </group>
  );
};

function getActivePosition(points: Vector3[], progress: number): [number, number, number] {
  if (points.length === 0) return [0, 0.15, 0];
  const index = Math.floor(progress * (points.length - 1));
  const point = points[Math.min(index, points.length - 1)];
  return [point.x, point.y + 0.15, point.z];
}
