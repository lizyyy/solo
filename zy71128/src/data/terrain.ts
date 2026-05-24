import { TerrainData } from '../types';

function generateHeightMap(width: number, height: number, scale: number = 0.1): number[][] {
  const heightMap: number[][] = [];
  
  for (let z = 0; z < height; z++) {
    const row: number[] = [];
    for (let x = 0; x < width; x++) {
      const nx = x * scale;
      const nz = z * scale;
      
      let h = 0;
      h += Math.sin(nx * 1.5) * Math.cos(nz * 1.5) * 15;
      h += Math.sin(nx * 2.5 + 1) * Math.cos(nz * 2.5 + 2) * 8;
      h += Math.sin(nx * 0.8) * Math.cos(nz * 1.2) * 20;
      
      const distFromCenter = Math.sqrt(
        Math.pow((x - width / 2) / (width / 2), 2) +
        Math.pow((z - height / 2) / (height / 2), 2)
      );
      h *= (1 - distFromCenter * 0.3);
      
      row.push(Math.max(0, h + 10));
    }
    heightMap.push(row);
  }
  
  return heightMap;
}

export const TERRAIN_DATA: TerrainData = {
  width: 100,
  height: 100,
  resolution: 1,
  heightMap: generateHeightMap(100, 100, 0.08)
};

export function getTerrainHeight(x: number, z: number, terrainData: TerrainData): number {
  const gridX = Math.floor((x + terrainData.width / 2) / terrainData.resolution);
  const gridZ = Math.floor((z + terrainData.height / 2) / terrainData.resolution);
  
  if (gridX < 0 || gridX >= terrainData.width || gridZ < 0 || gridZ >= terrainData.height) {
    return 0;
  }
  
  return terrainData.heightMap[gridZ][gridX];
}
