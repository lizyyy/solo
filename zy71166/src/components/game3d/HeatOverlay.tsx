import { useMemo } from 'react';
import type { Rack } from '../../engine/types';
import { ROOM_DIMENSIONS } from '../../engine/config';
import { tempToHeatmapColor } from '../../utils/temperature';

interface HeatOverlayProps {
  racks: Rack[];
  show: boolean;
}

export function HeatOverlay({ racks, show }: HeatOverlayProps) {
  const gridSize = 20;
  const cellWidth = ROOM_DIMENSIONS.width / gridSize;
  const cellDepth = ROOM_DIMENSIONS.depth / gridSize;

  const heatData = useMemo(() => {
    if (!show) return [];

    const data: Array<{
      position: [number, number, number];
      color: [number, number, number, number];
    }> = [];

    for (let i = 0; i < gridSize; i++) {
      for (let j = 0; j < gridSize; j++) {
        const x = -ROOM_DIMENSIONS.width / 2 + cellWidth * (i + 0.5);
        const z = -ROOM_DIMENSIONS.depth / 2 + cellDepth * (j + 0.5);

        let totalInfluence = 0;
        let weightedTemp = 0;

        for (const rack of racks) {
          const dist = Math.sqrt(
            Math.pow(x - rack.position.x, 2) + Math.pow(z - rack.position.z, 2),
          );
          const influence = Math.max(0, 1 - dist / 6);
          if (influence > 0) {
            totalInfluence += influence;
            weightedTemp += rack.temperature * influence;
          }
        }

        if (totalInfluence > 0) {
          const avgTemp = weightedTemp / totalInfluence;
          const color = tempToHeatmapColor(avgTemp);
          data.push({
            position: [x, 0.02, z],
            color,
          });
        }
      }
    }

    return data;
  }, [racks, show, cellWidth, cellDepth]);

  if (!show) return null;

  return (
    <group>
      {heatData.map((cell, idx) => (
        <mesh
          key={idx}
          position={cell.position}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[cellWidth * 0.95, cellDepth * 0.95]} />
          <meshBasicMaterial
            color={`rgb(${cell.color[0] * 255}, ${cell.color[1] * 255}, ${cell.color[2] * 255})`}
            transparent
            opacity={cell.color[3]}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
