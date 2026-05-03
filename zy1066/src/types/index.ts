export type HoldShape = 'jug' | 'crimp' | 'pocket' | 'edge' | 'sloper';
export type HoldSize = 'small' | 'medium' | 'large';
export type DifficultyLevel = 'beginner' | 'intermediate' | 'advanced';
export type RiskLevel = 'safe' | 'warning' | 'danger';
export type ViewMode = '2d' | '3d';

export interface Position {
  x: number;
  y: number;
}

export interface WallZone {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  riskMultiplier: number;
}

export interface WallConfig {
  id: string;
  name: string;
  width: number;
  height: number;
  angle: number;
  zones: WallZone[];
  createdAt: number;
  updatedAt: number;
}

export interface Hold {
  id: string;
  routeId: string;
  shape: HoldShape;
  color: string;
  size: HoldSize;
  position: Position;
  rotation: number;
  isStart: boolean;
  isEnd: boolean;
  order: number;
  notes?: string;
}

export interface Route {
  id: string;
  wallId: string;
  name: string;
  color: string;
  difficulty: DifficultyLevel;
  estimatedGrade: string;
  holds: Hold[];
  createdAt: number;
  updatedAt: number;
  notes?: string;
}

export interface RiskAssessment {
  routeId: string;
  overallRisk: RiskLevel;
  riskScore: number;
  assessments: {
    type: string;
    level: RiskLevel;
    message: string;
    details?: string;
    affectedHolds?: string[];
  }[];
  heatmapData: HeatmapCell[];
}

export interface HeatmapCell {
  x: number;
  y: number;
  intensity: number;
  category: 'density' | 'height' | 'distance' | 'zone';
}

export interface UserProfile {
  height: number;
  armSpan: number;
  skillLevel: DifficultyLevel;
}

export interface ProjectData {
  walls: WallConfig[];
  routes: Route[];
  activeWallId: string | null;
  activeRouteId: string | null;
  userProfile: UserProfile;
  viewMode: ViewMode;
}

export interface ExportReport {
  title: string;
  generatedAt: string;
  wall: WallConfig;
  routes: (Route & {
    assessment: RiskAssessment;
  })[];
  overallSummary: {
    totalRoutes: number;
    byDifficulty: Record<DifficultyLevel, number>;
    byRisk: Record<RiskLevel, number>;
    avgRiskScore: number;
  };
  recommendations: string[];
}
