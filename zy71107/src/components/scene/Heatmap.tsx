import React, { useMemo } from 'react';
import { useSceneStore } from '../../store/useSceneStore';
import { getHeatmapData } from '../../utils/dataValidator';

const getHeatColor = (intensity: number): string => {
  if (intensity < 0.25) return `rgba(0, 212, 255, ${intensity + 0.3})`;
  if (intensity < 0.5) return `rgba(0, 255, 136, ${intensity + 0.3})`;
  if (intensity < 0.75) return `rgba(255, 221, 0, ${intensity + 0.3})`;
  return `rgba(255, 107, 53, ${intensity + 0.3})`;
};

const Heatmap: React.FC = () => {
  const showHeatmap = useSceneStore((state) => state.showHeatmap);
  const trajectories = useSceneStore((state) => state.trajectories);
  const currentTime = useSceneStore((state) => state.currentTime);
  const hallData = useSceneStore((state) => state.hallData);
  const selectedShowcases = useSceneStore((state) => state.selectedShowcases);

  if (!showHeatmap || !hallData) return null;

  const heatPoints = getHeatmapData(trajectories, currentTime, hallData.showcases);

  const filteredPoints = selectedShowcases.length > 0
    ? heatPoints.filter((p) => !p.showcaseId || selectedShowcases.includes(p.showcaseId))
    : heatPoints;

  return (
    <group>
      {filteredPoints.map((point, index) => (
        <mesh
          key={index}
          position={[point.position.x, 0.05, point.position.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.1, 1.5 * point.intensity + 0.5, 32]} />
          <meshBasicMaterial
            color={getHeatColor(point.intensity)}
            transparent
            opacity={point.intensity * 0.6}
            side={2}
          />
        </mesh>
      ))}

      {filteredPoints.map((point, index) => (
        <mesh
          key={`center-${index}`}
          position={[point.position.x, 0.06, point.position.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <circleGeometry args={[0.3 * point.intensity + 0.2, 32]} />
          <meshBasicMaterial
            color={getHeatColor(point.intensity)}
            transparent
            opacity={point.intensity * 0.8}
          />
        </mesh>
      ))}
    </group>
  );
};

export default Heatmap;
