import { useRef, useMemo } from 'react';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

interface PointCloudProps {
  count?: number;
}

export function PointCloud({ count = 2000 }: PointCloudProps) {
  const ref = useRef<THREE.Points>(null);

  const [positions, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;

      const angle = Math.random() * Math.PI * 2;
      const radius = 3 + Math.random() * 8;
      const height = Math.random() * 6 - 1;

      pos[i3] = Math.cos(angle) * radius + (Math.random() - 0.5) * 2;
      pos[i3 + 1] = height + (Math.random() - 0.5) * 0.5;
      pos[i3 + 2] = Math.sin(angle) * radius + (Math.random() - 0.5) * 2;

      const brightness = 0.4 + Math.random() * 0.4;
      col[i3] = 0.3 + Math.random() * 0.2;
      col[i3 + 1] = 0.5 + Math.random() * 0.3;
      col[i3 + 2] = brightness;
    }

    return [pos, col];
  }, [count]);

  return (
    <Points
      ref={ref}
      positions={positions}
      colors={colors}
      stride={3}
      frustumCulled={false}
    >
      <PointMaterial
        transparent
        vertexColors
        size={0.08}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </Points>
  );
}
