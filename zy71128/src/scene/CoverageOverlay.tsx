import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore } from '../store/useStore';
import { TERRAIN_DATA } from '../data/terrain';

export function CoverageOverlay() {
  const showCoverage = useStore(state => state.showCoverage);
  const coverageMap = useStore(state => state.coverageMap);

  const geometry = useMemo(() => {
    const gridSize = 5;
    const geo = new THREE.PlaneGeometry(
      TERRAIN_DATA.width,
      TERRAIN_DATA.height,
      TERRAIN_DATA.width / gridSize - 1,
      TERRAIN_DATA.height / gridSize - 1
    );
    
    geo.rotateX(-Math.PI / 2);
    
    const positions = geo.attributes.position;
    const colors = new Float32Array(positions.count * 3);
    
    for (let z = 0; z < coverageMap.length; z++) {
      for (let x = 0; x < coverageMap[z].length; x++) {
        const i = z * coverageMap[z].length + x;
        const isCovered = coverageMap[z]?.[x] ?? false;
        
        if (isCovered) {
          colors[i * 3] = 0.12;
          colors[i * 3 + 1] = 0.53;
          colors[i * 3 + 2] = 0.9;
        } else {
          colors[i * 3] = 0.9;
          colors[i * 3 + 1] = 0.22;
          colors[i * 3 + 2] = 0.21;
        }
      }
    }
    
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    
    return geo;
  }, [coverageMap]);

  if (!showCoverage) return null;

  return (
    <mesh geometry={geometry} position={[0, 0.5, 0]}>
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
