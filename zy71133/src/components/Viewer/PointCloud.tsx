import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Point3D } from '@/types';

interface PointCloudProps {
  points: Point3D[];
  pointSize?: number;
}

export function PointCloud({ points, pointSize = 0.3 }: PointCloudProps) {
  const pointsRef = useRef<THREE.Points>(null);

  const geometry = useMemo(() => {
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);

    points.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;

      if (point.color !== undefined) {
        const r = ((point.color >> 16) & 255) / 255;
        const g = ((point.color >> 8) & 255) / 255;
        const b = (point.color & 255) / 255;
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      } else {
        const heightFactor = Math.min(1, point.y / 20);
        colors[i * 3] = 0.3 + heightFactor * 0.4;
        colors[i * 3 + 1] = 0.3 + heightFactor * 0.3;
        colors[i * 3 + 2] = 0.3;
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return geo;
  }, [points]);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += 0;
    }
  });

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial
        size={pointSize}
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.9}
      />
    </points>
  );
}
