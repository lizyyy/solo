import { useMemo } from 'react';
import * as THREE from 'three';
import { TerrainData } from '../../types';

interface TerrainProps {
  data: TerrainData;
}

export function Terrain({ data }: TerrainProps) {
  const { geometry, material } = useMemo(() => {
    const { heightmap, width, depth, scale } = data;
    const segmentsX = heightmap[0]?.length - 1 || 50;
    const segmentsZ = heightmap.length - 1 || 80;

    const geometry = new THREE.PlaneGeometry(
      width,
      depth,
      segmentsX,
      segmentsZ
    );
    
    geometry.rotateX(-Math.PI / 2);
    geometry.translate(width / 2, 0, depth / 2);

    const positions = geometry.attributes.position;
    for (let z = 0; z <= segmentsZ; z++) {
      for (let x = 0; x <= segmentsX; x++) {
        const index = z * (segmentsX + 1) + x;
        const heightValue = heightmap[z]?.[x] || 0;
        positions.setY(index, heightValue * scale * 0.5);
      }
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: '#E8F3FF',
      flatShading: true,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.1
    });

    return { geometry, material };
  }, [data]);

  return (
    <mesh geometry={geometry} material={material} receiveShadow>
      <meshStandardMaterial
        attach="material"
        color="#E8F3FF"
        flatShading
        side={THREE.DoubleSide}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
}

export default Terrain;
