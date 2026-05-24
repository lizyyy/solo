import { useMemo } from 'react';
import { HeatmapPoint } from '../../types';

interface Heatmap3DProps {
  points: HeatmapPoint[];
  visible: boolean;
}

function getHeatColor(intensity: number): [number, number, number] {
  if (intensity < 0.3) {
    return [0, 1, 1];
  } else if (intensity < 0.5) {
    return [0, intensity * 2, 1];
  } else if (intensity < 0.7) {
    return [(intensity - 0.5) * 5, 1, 0];
  } else {
    return [1, 1 - (intensity - 0.7) * 1.5, 0];
  }
}

export function Heatmap3D({ points, visible }: Heatmap3DProps) {
  const heatmapData = useMemo(() => {
    return points.map((point, index) => {
      const [r, g, b] = getHeatColor(point.intensity);
      return { ...point, r, g, b, key: index };
    });
  }, [points]);

  if (!visible) return null;

  return (
    <group position={[0, 0.02, 0]}>
      {heatmapData.map((point) => (
        <mesh
          key={point.key}
          position={[point.x, 0, point.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial
            color={[point.r, point.g, point.b]}
            transparent
            opacity={point.intensity * 0.7}
          />
        </mesh>
      ))}
    </group>
  );
}
