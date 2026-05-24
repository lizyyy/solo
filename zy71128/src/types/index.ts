export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface TerrainData {
  width: number;
  height: number;
  resolution: number;
  heightMap: number[][];
}

export interface Watchtower {
  id: string;
  name: string;
  position: Position3D;
  height: number;
  viewDistance: number;
  viewAngle: number;
  enabled: boolean;
}

export interface PatrolRoute {
  id: string;
  name: string;
  points: Position3D[];
  color: string;
  enabled: boolean;
  coverageScore?: number;
}

export interface BlindSpot {
  id: string;
  position: Position3D;
  area: number;
  severity: 'high' | 'medium' | 'low';
  reason: 'terrain' | 'trees' | 'distance';
  visibleFrom?: string[];
}

export interface FirePoint {
  id: string;
  position: Position3D;
  intensity: number;
  detected: boolean;
  timestamp: string;
}

export interface TreeData {
  id: string;
  position: Position3D;
  height: number;
  type: 'pine' | 'oak' | 'birch';
}

export interface Season {
  id: string;
  name: string;
  treeHeightFactor: number;
  foliageDensity: number;
  sunAngle: number;
  color: string;
}

export interface CoverageAnalysis {
  totalArea: number;
  coveredArea: number;
  coverageRate: number;
  blindSpotCount: number;
  blindSpotArea: number;
}

export interface ViewPoint {
  position: Position3D;
  timestamp: number;
}

export interface ReportData {
  generatedAt: string;
  season: Season;
  watchtowers: Watchtower[];
  routes: PatrolRoute[];
  coverage: CoverageAnalysis;
  blindSpots: BlindSpot[];
  recommendations: string[];
}
