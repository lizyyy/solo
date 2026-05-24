import { useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../../store';
import { getThicknessColor, hexToRgb } from '../../utils/colors';

export const IceSurface = () => {
  const data = useAppStore((state) => state.data);
  const currentTimeIndex = useAppStore((state) => state.currentTimeIndex);
  const viewMode = useAppStore((state) => state.viewMode);
  const showHeatmap = useAppStore((state) => state.showHeatmap);
  const showThreshold = useAppStore((state) => state.showThreshold);

  const geometry = useMemo(() => {
    if (!data) return null;

    const { width, height, gridSize } = data.rink;
    const cols = Math.floor(width / gridSize);
    const rows = Math.floor(height / gridSize);

    const geo = new THREE.PlaneGeometry(width, height, cols - 1, rows - 1);
    geo.rotateX(-Math.PI / 2);

    return geo;
  }, [data]);

  const { positions, colors } = useMemo(() => {
    if (!data || !geometry) return { positions: null, colors: null };

    const snapshot = data.snapshots[currentTimeIndex];
    const { gridSize, width, height, thicknessThreshold } = data.rink;
    const cols = Math.floor(width / gridSize);
    const rows = Math.floor(height / gridSize);

    const posArray = geometry.attributes.position.array as Float32Array;
    const colorArray = new Float32Array(posArray.length);

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const index = row * cols + col;
        const vertexIndex = index * 3;

        const sample = snapshot.thicknessSamples.find(
          (s) => s.gridId === `grid-${row}-${col}`
        );

        const heightVal = sample ? sample.thickness * 0.1 : 2;
        posArray[vertexIndex + 2] = heightVal;

        if (sample && showHeatmap) {
          const color = getThicknessColor(sample.thickness, thicknessThreshold);
          const rgb = hexToRgb(color);
          colorArray[vertexIndex] = rgb.r;
          colorArray[vertexIndex + 1] = rgb.g;
          colorArray[vertexIndex + 2] = rgb.b;
        } else {
          colorArray[vertexIndex] = 0.7;
          colorArray[vertexIndex + 1] = 0.9;
          colorArray[vertexIndex + 2] = 1.0;
        }
      }
    }

    return { positions: posArray, colors: colorArray };
  }, [data, currentTimeIndex, viewMode, showHeatmap, geometry]);

  if (!data || !geometry) return null;

  geometry.setAttribute('position', new THREE.BufferAttribute(positions!, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors!, 3));
  geometry.computeVertexNormals();

  return (
    <group>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          vertexColors={showHeatmap}
          transparent
          opacity={0.85}
          side={THREE.DoubleSide}
          color={showHeatmap ? undefined : '#a5f3fc'}
          metalness={0.1}
          roughness={0.3}
        />
      </mesh>

      {showThreshold && (
        <mesh position={[data.rink.width / 2, data.rink.thicknessThreshold * 0.1, data.rink.height / 2]}>
          <planeGeometry args={[data.rink.width, data.rink.height]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.15} side={THREE.DoubleSide} />
        </mesh>
      )}

      <mesh
        position={[data.rink.width / 2, 0, data.rink.height / 2]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[data.rink.width + 2, data.rink.height + 2]} />
        <meshStandardMaterial color="#1e3a5f" />
      </mesh>
    </group>
  );
};
