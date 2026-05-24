import { useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../../store';
import { getStatusColor, hexToRgb } from '../../utils/colors';

export const GridPoints = () => {
  const data = useAppStore((state) => state.data);
  const currentTimeIndex = useAppStore((state) => state.currentTimeIndex);
  const showGrid = useAppStore((state) => state.showGrid);
  const hoveredPoint = useAppStore((state) => state.hoveredPoint);
  const selectedGridIds = useAppStore((state) => state.selectedGridIds);

  const points = useMemo(() => {
    if (!data || !showGrid) return null;

    const snapshot = data.snapshots[currentTimeIndex];
    const instancedMesh = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.25, 16, 16),
      new THREE.MeshStandardMaterial({
        emissive: '#ffffff',
        emissiveIntensity: 0.3,
      }),
      data.gridPoints.length
    );

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();

    data.gridPoints.forEach((point, index) => {
      const sample = snapshot.thicknessSamples.find((s) => s.gridId === point.id);
      const status = sample?.status || 'missing';
      const col = getStatusColor(status);

      const height = sample ? sample.thickness * 0.1 + 0.3 : 0.5;

      dummy.position.set(point.x, height, point.y);

      if (point.id === hoveredPoint || selectedGridIds.includes(point.id)) {
        dummy.scale.set(1.5, 1.5, 1.5);
      } else {
        dummy.scale.set(1, 1, 1);
      }

      dummy.updateMatrix();
      instancedMesh.setMatrixAt(index, dummy.matrix);

      const rgb = hexToRgb(col);
      color.setRGB(rgb.r, rgb.g, rgb.b);
      instancedMesh.setColorAt(index, color);
    });

    instancedMesh.instanceMatrix.needsUpdate = true;
    if (instancedMesh.instanceColor) {
      instancedMesh.instanceColor.needsUpdate = true;
    }

    return instancedMesh;
  }, [data, currentTimeIndex, showGrid, hoveredPoint, selectedGridIds]);

  if (!points) return null;

  return <primitive object={points} />;
};
