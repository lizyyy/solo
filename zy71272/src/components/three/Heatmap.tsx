import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useStore } from '../../store/useStore';
import { dbToColor } from '../../utils/helpers';
import { HEATMAP_GRID_SIZE } from '../../utils/constants';

export default function Heatmap() {
  const heatmapData = useStore(state => state.heatmapData);
  const roomConfig = useStore(state => state.roomConfig);
  const showHeatmap = useStore(state => state.showHeatmap);

  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, material } = useMemo(() => {
    if (!showHeatmap || !roomConfig || heatmapData.length === 0) {
      return { geometry: null, material: null };
    }

    const { width, length } = roomConfig;
    const gridSize = HEATMAP_GRID_SIZE;
    const cols = Math.floor(width / gridSize);
    const rows = Math.floor(length / gridSize);

    const geometry = new THREE.PlaneGeometry(width, length, cols - 1, rows - 1);
    const colors = new Float32Array(geometry.attributes.position.count * 3);

    const colorMap = new Map<string, [number, number, number]>();
    heatmapData.forEach(sample => {
      const key = `${sample.position.x.toFixed(2)},${sample.position.z.toFixed(2)}`;
      colorMap.set(key, dbToColor(sample.level));
    });

    const positions = geometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getY(i);

      let nearestColor: [number, number, number] = [0, 0, 255];
      let minDist = Infinity;

      colorMap.forEach((color, key) => {
        const [sx, sz] = key.split(',').map(Number);
        const dist = Math.sqrt((x - sx) ** 2 + (z - sz) ** 2);
        if (dist < minDist) {
          minDist = dist;
          nearestColor = color;
        }
      });

      colors[i * 3] = nearestColor[0] / 255;
      colors[i * 3 + 1] = nearestColor[1] / 255;
      colors[i * 3 + 2] = nearestColor[2] / 255;
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });

    return { geometry, material };
  }, [heatmapData, roomConfig, showHeatmap]);

  if (!geometry || !material || !showHeatmap) return null;

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.03, 0]}
      receiveShadow
    />
  );
}
