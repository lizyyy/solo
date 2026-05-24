import { useMemo, useRef } from 'react';
import { DataTexture, RGBFormat, FloatType } from 'three';
import { useSimulationStore } from '../../store/useSimulationStore';
import { getHeatmapColor } from '../../utils/heatmap';

export function Heatmap() {
  const { heatmapData, showHeatmap, plants, greenhouse } = useSimulationStore();
  const textureRef = useRef<DataTexture | null>(null);
  
  const texture = useMemo(() => {
    const resolution = heatmapData.length;
    const data = new Float32Array(resolution * resolution * 3);
    
    for (let i = 0; i < resolution; i++) {
      for (let j = 0; j < resolution; j++) {
        const value = heatmapData[i][j];
        const color = getHeatmapColor(value);
        const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        
        if (rgbMatch) {
          const idx = (i * resolution + j) * 3;
          data[idx] = parseInt(rgbMatch[1]) / 255;
          data[idx + 1] = parseInt(rgbMatch[2]) / 255;
          data[idx + 2] = parseInt(rgbMatch[3]) / 255;
        }
      }
    }
    
    const tex = new DataTexture(
      data,
      resolution,
      resolution,
      RGBFormat,
      FloatType
    );
    tex.needsUpdate = true;
    textureRef.current = tex;
    return tex;
  }, [heatmapData]);
  
  if (!showHeatmap) return null;
  
  const width = Math.min(greenhouse.width, plants.rowsCount * plants.rowSpacing / 100 + 2);
  const length = Math.min(greenhouse.length, plants.plantsPerRow * plants.plantSpacing / 100 + 2);
  
  return (
    <mesh
      position={[0, 0.05, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={[width, length]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.7}
        side={2}
      />
    </mesh>
  );
}
