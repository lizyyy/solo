import { Watchtower, BlindSpot, TerrainData, TreeData, Season, Position3D } from '../types';
import { getTerrainHeight } from '../data/terrain';

export interface VisibilityResult {
  isVisible: boolean;
  obstructionHeight: number;
  obstructionType: 'terrain' | 'trees' | 'none';
}

export function checkVisibility(
  observerPos: Position3D,
  observerHeight: number,
  targetPos: Position3D,
  terrainData: TerrainData,
  trees: TreeData[],
  season: Season,
  maxDistance: number
): VisibilityResult {
  const distance = Math.sqrt(
    Math.pow(targetPos.x - observerPos.x, 2) +
    Math.pow(targetPos.z - observerPos.z, 2)
  );

  if (distance > maxDistance) {
    return { isVisible: false, obstructionHeight: 0, obstructionType: 'none' };
  }

  const observerEye = {
    x: observerPos.x,
    y: observerPos.y + observerHeight,
    z: observerPos.z
  };

  const steps = Math.ceil(distance / 2);
  const stepSize = 1 / steps;

  let maxObstructionHeight = -Infinity;
  let obstructionType: 'terrain' | 'trees' | 'none' = 'none';

  for (let i = 1; i < steps; i++) {
    const t = i * stepSize;
    const sampleX = observerEye.x + (targetPos.x - observerEye.x) * t;
    const sampleZ = observerEye.z + (targetPos.z - observerEye.z) * t;
    
    const lineOfSightHeight = observerEye.y + (targetPos.y - observerEye.y) * t;
    const terrainHeight = getTerrainHeight(sampleX, sampleZ, terrainData);

    if (terrainHeight > lineOfSightHeight) {
      return { isVisible: false, obstructionHeight: terrainHeight, obstructionType: 'terrain' };
    }

    if (terrainHeight > maxObstructionHeight) {
      maxObstructionHeight = terrainHeight;
      obstructionType = 'terrain';
    }

    for (const tree of trees) {
      const treeDistance = Math.sqrt(
        Math.pow(sampleX - tree.position.x, 2) +
        Math.pow(sampleZ - tree.position.z, 2)
      );

      if (treeDistance < 2) {
        const treeTop = tree.position.y + tree.height * season.treeHeightFactor;
        if (treeTop > lineOfSightHeight) {
          return { isVisible: false, obstructionHeight: treeTop, obstructionType: 'trees' };
        }
        if (treeTop > maxObstructionHeight) {
          maxObstructionHeight = treeTop;
          obstructionType = 'trees';
        }
      }
    }
  }

  return { isVisible: true, obstructionHeight: maxObstructionHeight, obstructionType };
}

export function calculateCoverageMap(
  watchtowers: Watchtower[],
  terrainData: TerrainData,
  trees: TreeData[],
  season: Season,
  gridSize: number = 5
): boolean[][] {
  const width = Math.ceil(terrainData.width / gridSize);
  const height = Math.ceil(terrainData.height / gridSize);
  const coverageMap: boolean[][] = [];

  const enabledTowers = watchtowers.filter(t => t.enabled);

  for (let z = 0; z < height; z++) {
    const row: boolean[] = [];
    for (let x = 0; x < width; x++) {
      const worldX = (x * gridSize) - terrainData.width / 2 + gridSize / 2;
      const worldZ = (z * gridSize) - terrainData.height / 2 + gridSize / 2;
      const worldY = getTerrainHeight(worldX, worldZ, terrainData);

      let isCovered = false;
      for (const tower of enabledTowers) {
        const result = checkVisibility(
          tower.position,
          tower.height,
          { x: worldX, y: worldY, z: worldZ },
          terrainData,
          trees,
          season,
          tower.viewDistance
        );
        if (result.isVisible) {
          isCovered = true;
          break;
        }
      }
      row.push(isCovered);
    }
    coverageMap.push(row);
  }

  return coverageMap;
}

export function detectBlindSpots(
  watchtowers: Watchtower[],
  terrainData: TerrainData,
  trees: TreeData[],
  season: Season,
  coverageMap: boolean[][]
): BlindSpot[] {
  const blindSpots: BlindSpot[] = [];
  const gridSize = 5;
  const enabledTowers = watchtowers.filter(t => t.enabled);

  for (let z = 0; z < coverageMap.length; z++) {
    for (let x = 0; x < coverageMap[z].length; x++) {
      if (!coverageMap[z][x]) {
        const worldX = (x * gridSize) - terrainData.width / 2 + gridSize / 2;
        const worldZ = (z * gridSize) - terrainData.height / 2 + gridSize / 2;
        const worldY = getTerrainHeight(worldX, worldZ, terrainData);

        let minDistance = Infinity;
        let obstructionReason: 'terrain' | 'trees' | 'distance' = 'distance';
        const visibleFrom: string[] = [];

        for (const tower of enabledTowers) {
          const dist = Math.sqrt(
            Math.pow(worldX - tower.position.x, 2) +
            Math.pow(worldZ - tower.position.z, 2)
          );

          if (dist < minDistance) {
            minDistance = dist;
          }

          const result = checkVisibility(
            tower.position,
            tower.height,
            { x: worldX, y: worldY, z: worldZ },
            terrainData,
            trees,
            season,
            tower.viewDistance
          );

          if (!result.isVisible && result.obstructionType !== 'none') {
            obstructionReason = result.obstructionType;
          }
        }

        let severity: 'high' | 'medium' | 'low' = 'low';
        if (minDistance > 40 || obstructionReason === 'terrain') {
          severity = 'high';
        } else if (minDistance > 25) {
          severity = 'medium';
        }

        if (blindSpots.length < 20) {
          blindSpots.push({
            id: `blind-${x}-${z}`,
            position: { x: worldX, y: worldY, z: worldZ },
            area: gridSize * gridSize,
            severity,
            reason: obstructionReason,
            visibleFrom
          });
        }
      }
    }
  }

  return blindSpots;
}

export function calculateCoverageStats(
  coverageMap: boolean[][],
  blindSpots: BlindSpot[],
  gridSize: number = 5
) {
  let coveredCells = 0;
  let totalCells = 0;

  for (const row of coverageMap) {
    for (const cell of row) {
      totalCells++;
      if (cell) coveredCells++;
    }
  }

  const totalArea = totalCells * gridSize * gridSize;
  const coveredArea = coveredCells * gridSize * gridSize;
  const blindSpotArea = blindSpots.reduce((sum, b) => sum + b.area, 0);

  return {
    totalArea,
    coveredArea,
    coverageRate: totalCells > 0 ? coveredCells / totalCells : 0,
    blindSpotCount: blindSpots.length,
    blindSpotArea
  };
}
