import { useMemo } from 'react';
import * as THREE from 'three';
import type { Gallery, IlluminationSample } from '@/types';
import { useMainStore } from '@/store/mainStore';
import { useLightCalculation } from '@/hooks/useLightCalculation';

interface HeatmapProps {
  gallery: Gallery;
}

function createHeatmapTexture(samples: IlluminationSample[], width: number, depth: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;

  const imageData = ctx.createImageData(64, 64);
  const gridSize = 64;
  const halfWidth = width / 2;
  const halfDepth = depth / 2;

  for (let y = 0; y < gridSize; y++) {
    for (let x = 0; x < gridSize; x++) {
      const worldX = (x / gridSize) * width - halfWidth;
      const worldZ = (y / gridSize) * depth - halfDepth;

      let totalValue = 0;
      let totalWeight = 0;

      for (const sample of samples) {
        const dx = worldX - sample.position.x;
        const dz = worldZ - sample.position.z;
        const distance = Math.sqrt(dx * dx + dz * dz);
        const radius = 3;

        if (distance < radius) {
          const weight = 1 - distance / radius;
          totalValue += sample.value * weight;
          totalWeight += weight;
        }
      }

      const value = totalWeight > 0 ? totalValue / totalWeight : 0;
      const maxValue = 1000;
      const ratio = Math.min(value / maxValue, 1);

      let r = 0, g = 0, b = 0, a = 0;
      if (ratio > 0) {
        a = Math.floor((0.15 + ratio * 0.5) * 255);
        if (ratio < 0.25) {
          r = 47; g = 128; b = 237;
        } else if (ratio < 0.5) {
          r = 39; g = 174; b = 96;
        } else if (ratio < 0.75) {
          r = 242; g = 153; b = 74;
        } else {
          r = 229; g = 72; b = 77;
        }
      }

      const idx = (y * gridSize + x) * 4;
      imageData.data[idx] = r;
      imageData.data[idx + 1] = g;
      imageData.data[idx + 2] = b;
      imageData.data[idx + 3] = a;
    }
  }

  ctx.putImageData(imageData, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

export default function Heatmap({ gallery }: HeatmapProps) {
  const { lightSources } = useMainStore();
  const { getIlluminationAt } = useLightCalculation(
    lightSources,
    gallery.walls,
    gallery.width,
    gallery.depth
  );

  const floorTexture = useMemo(() => {
    const samples: IlluminationSample[] = [];
    const step = 1;
    for (let x = -gallery.width / 2; x <= gallery.width / 2; x += step) {
      for (let z = -gallery.depth / 2; z <= gallery.depth / 2; z += step) {
        const value = getIlluminationAt({ x, y: 0.1, z });
        samples.push({ position: { x, y: 0.1, z }, value });
      }
    }
    return createHeatmapTexture(samples, gallery.width, gallery.depth);
  }, [gallery, getIlluminationAt]);

  const wallHeatPlanes = useMemo(() => {
    return gallery.walls.map((wall) => {
      const dx = wall.end.x - wall.start.x;
      const dz = wall.end.z - wall.start.z;
      const length = Math.sqrt(dx * dx + dz * dz);
      const angle = Math.atan2(dz, dx);
      const centerX = (wall.start.x + wall.end.x) / 2;
      const centerY = wall.height / 2;
      const centerZ = (wall.start.z + wall.end.z) / 2;

      const samples: IlluminationSample[] = [];
      const step = 0.5;
      for (let l = 0; l <= length; l += step) {
        for (let h = 0; h <= wall.height; h += step) {
          const t = l / length;
          const x = wall.start.x + dx * t;
          const z = wall.start.z + dz * t;
          const value = getIlluminationAt({ x, y: h, z });
          samples.push({ position: { x, y: h, z }, value });
        }
      }

      const texture = createHeatmapTexture(samples, length, wall.height);

      return {
        key: wall.id,
        position: [centerX, centerY, centerZ] as [number, number, number],
        rotation: [0, -angle + Math.PI / 2, 0] as [number, number, number],
        args: [length, wall.height] as [number, number],
        texture
      };
    });
  }, [gallery, getIlluminationAt]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[gallery.width, gallery.depth]} />
        <meshBasicMaterial map={floorTexture} transparent depthWrite={false} />
      </mesh>

      {wallHeatPlanes.map((plane) => (
        <mesh
          key={plane.key}
          position={plane.position}
          rotation={plane.rotation}
        >
          <planeGeometry args={plane.args} />
          <meshBasicMaterial map={plane.texture} transparent depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}
