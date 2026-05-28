import { useMemo } from 'react';
import { Line } from '@react-three/drei';

interface InterpolationPathProps {
  pathPoints: { x: number; y: number; z: number }[];
  color: string;
  progress: number;
}

export default function InterpolationPath({ pathPoints, color, progress }: InterpolationPathProps) {
  const fullPoints = useMemo(
    () => pathPoints.map((p) => [p.x, p.y, p.z] as [number, number, number]),
    [pathPoints]
  );

  const activePoints = useMemo(() => {
    const endIdx = Math.max(1, Math.floor(progress * (pathPoints.length - 1)) + 1);
    return pathPoints.slice(0, endIdx).map((p) => [p.x, p.y, p.z] as [number, number, number]);
  }, [pathPoints, progress]);

  if (fullPoints.length < 2) return null;

  return (
    <group>
      <Line
        points={fullPoints}
        color={color}
        lineWidth={1}
        transparent
        opacity={0.25}
      />
      {activePoints.length >= 2 && (
        <Line
          points={activePoints}
          color={color}
          lineWidth={2.5}
        />
      )}
    </group>
  );
}
