import { useMemo } from 'react';
import { BufferGeometry, Float32BufferAttribute, Uint32BufferAttribute } from 'three';
import { generateSlopeGeometry } from '../../utils/terrain';

interface SlopeTerrainProps {
  size?: number;
  segments?: number;
}

export function SlopeTerrain({ size = 40, segments = 50 }: SlopeTerrainProps) {
  const geometry = useMemo(() => {
    const { vertices, indices, colors } = generateSlopeGeometry(size, segments);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(vertices, 3));
    geo.setAttribute('color', new Float32BufferAttribute(colors, 3));
    geo.setIndex(new Uint32BufferAttribute(indices, 1));
    geo.computeVertexNormals();
    return geo;
  }, [size, segments]);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        vertexColors
        roughness={0.9}
        metalness={0.1}
        side={2}
      />
    </mesh>
  );
}
