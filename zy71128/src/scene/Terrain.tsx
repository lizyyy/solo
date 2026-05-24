import { useMemo } from 'react';
import * as THREE from 'three';
import { TERRAIN_DATA, getTerrainHeight } from '../data/terrain';

export function Terrain() {
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      TERRAIN_DATA.width,
      TERRAIN_DATA.height,
      TERRAIN_DATA.width - 1,
      TERRAIN_DATA.height - 1
    );
    
    geo.rotateX(-Math.PI / 2);
    
    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getZ(i);
      const height = getTerrainHeight(x, z, TERRAIN_DATA);
      positions.setY(i, height);
      
      const normalizedHeight = height / 35;
      const color = new THREE.Color();
      
      if (normalizedHeight < 0.3) {
        color.setRGB(0.4, 0.6, 0.3);
      } else if (normalizedHeight < 0.6) {
        color.setRGB(0.35, 0.5, 0.25);
      } else {
        color.setRGB(0.5, 0.45, 0.4);
      }
      
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    
    return geo;
  }, []);

  return (
    <mesh geometry={geometry} receiveShadow>
      <meshStandardMaterial
        vertexColors
        side={THREE.DoubleSide}
        roughness={0.8}
        metalness={0.1}
      />
    </mesh>
  );
}
