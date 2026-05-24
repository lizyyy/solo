import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { generateCoverageTextureData } from '../utils/coverage';

export function CoverageHeatmap() {
  const coverageResult = useStore((state) => state.coverageResult);
  const showHeatmap = useStore((state) => state.showHeatmap);
  const field = useStore((state) => state.field);
  const environment = useStore((state) => state.environment);

  const texture = useMemo(() => {
    if (!coverageResult) return null;

    const imageData = generateCoverageTextureData(coverageResult, field);
    const tex = new THREE.CanvasTexture(document.createElement('canvas'));

    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);

    tex.image = canvas;
    tex.needsUpdate = true;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;

    return tex;
  }, [coverageResult, field]);

  const { width, height } = field;
  const { slope, slopeDirection } = environment;

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, height, 1, 1);
    geo.rotateX(-Math.PI / 2);

    if (slope !== 0) {
      const positions = geo.attributes.position;
      const slopeRad = (slope * Math.PI) / 180;
      const dirRad = (slopeDirection * Math.PI) / 180;

      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const proj = x * Math.cos(dirRad) + z * Math.sin(dirRad);
        positions.setY(i, proj * Math.tan(slopeRad) + 0.02);
      }
      geo.computeVertexNormals();
    } else {
      const positions = geo.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        positions.setY(i, 0.02);
      }
    }

    return geo;
  }, [width, height, slope, slopeDirection]);

  if (!showHeatmap || !texture || !coverageResult) {
    return null;
  }

  return (
    <mesh geometry={geometry}>
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.7}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
