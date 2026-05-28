import { useMemo } from 'react';
import * as THREE from 'three';
import type { Shelf } from '../types';
import { congestionToColor } from '../utils/colors';

interface HeatmapVolumeProps {
  shelves: Shelf[];
  floorZ: number;
  visible: boolean;
  resolution?: number;
}

export default function HeatmapVolume({ shelves, floorZ, visible, resolution = 2 }: HeatmapVolumeProps) {
  const voxels = useMemo(() => {
    const result: { position: [number, number, number]; scale: [number, number, number]; color: THREE.Color }[] = [];

    for (const shelf of shelves) {
      const level = shelf.congestionLevel ?? 0;
      if (level < 0.1) continue;

      const rgb = congestionToColor(level);
      const color = new THREE.Color(rgb.r / 255, rgb.g / 255, rgb.b / 255);
      const height = level * resolution * 2;

      const centerX = shelf.position.x;
      const centerZ = shelf.position.y;
      const w = shelf.dimensions.width * 1.2;
      const d = shelf.dimensions.depth * 1.2;

      result.push({
        position: [centerX, floorZ + height / 2 + shelf.dimensions.height, centerZ],
        scale: [w, height, d],
        color,
      });

      const spreadCount = Math.floor(level * 3);
      for (let i = 0; i < spreadCount; i++) {
        const angle = (i / spreadCount) * Math.PI * 2;
        const radius = Math.max(w, d) * 0.7;
        const sx = centerX + Math.cos(angle) * radius;
        const sz = centerZ + Math.sin(angle) * radius;
        const spreadHeight = height * 0.6;
        const spreadAlpha = 0.6;
        result.push({
          position: [sx, floorZ + spreadHeight / 2 + shelf.dimensions.height * 0.5, sz],
          scale: [w * 0.5 * spreadAlpha, spreadHeight, d * 0.5 * spreadAlpha],
          color,
        });
      }
    }

    return result;
  }, [shelves, floorZ, resolution]);

  if (!visible || voxels.length === 0) return null;

  return (
    <group>
      {voxels.map((voxel, i) => (
        <mesh key={i} position={voxel.position} scale={voxel.scale}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial
            color={voxel.color}
            transparent
            opacity={0.25}
            emissive={voxel.color}
            emissiveIntensity={0.2}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
