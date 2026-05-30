export type Vec3 = [number, number, number];

export type PathType = 'normal' | 'critical' | 'captured';

export type Severity = 'low' | 'medium' | 'high';

export type IssueType = 'scale' | 'penetration' | 'occlusion';

export type ObjectType = 'blackHole' | 'lightRay' | 'star';

export interface BlackHole {
  id: string;
  type: 'blackHole';
  mass: number;
  schwarzschildRadius: number;
  spin: number;
  dataSource: string;
  version: string;
  createdAt: Date;
  formula: string;
}

export interface LightRay {
  id: string;
  type: 'lightRay';
  blackHoleId: string;
  startPoint: Vec3;
  endPoint: Vec3;
  impactParameter: number;
  deflectionAngle: number;
  pathType: PathType;
  pathPoints: Vec3[];
  dataSource: string;
  version: string;
  createdAt: Date;
}

export interface Star {
  id: string;
  type: 'star';
  position: Vec3;
  magnitude: number;
  temperature: number;
  isLensed: boolean;
  lensedPosition?: Vec3;
  magnification?: number;
}

export interface StarField {
  id: string;
  starCount: number;
  distance: number;
  stars: Star[];
  dataSource: string;
  version: string;
  createdAt: Date;
}

export interface Viewpoint {
  id: string;
  name: string;
  cameraPosition: Vec3;
  cameraTarget: Vec3;
  fov: number;
  createdAt: Date;
}

export interface QualityIssue {
  type: IssueType;
  severity: Severity;
  description: string;
  humanReason: string;
  affectedIds: string[];
}

export interface QualityReport {
  id: string;
  timestamp: Date;
  issues: QualityIssue[];
  overallStatus: 'pass' | 'warning' | 'error';
}

export interface SimulationParameters {
  blackHoleMass: number;
  rayCount: number;
  observerDistance: number;
  starDensity: number;
  showEventHorizon: boolean;
  showPhotonSphere: boolean;
  lensStrength: number;
}

export interface VisibilityState {
  blackHole: boolean;
  lightRays: boolean;
  starField: boolean;
}

export interface DataVersion {
  id: string;
  version: string;
  description: string;
  createdAt: Date;
  author: string;
}

export type SelectableObject = BlackHole | LightRay | Star;

export interface AppState {
  blackHole: BlackHole;
  lightRays: LightRay[];
  starField: StarField;
  viewpoints: Viewpoint[];
  qualityReport: QualityReport | null;
  visibility: VisibilityState;
  selectedObject: SelectableObject | null;
  parameters: SimulationParameters;
  cameraPosition: Vec3;
  cameraTarget: Vec3;
}

export interface AppActions {
  setBlackHoleMass: (mass: number) => void;
  setRayCount: (count: number) => void;
  setObserverDistance: (distance: number) => void;
  setStarDensity: (density: number) => void;
  setLensStrength: (strength: number) => void;
  setVisibility: (visibility: Partial<VisibilityState>) => void;
  setSelectedObject: (obj: SelectableObject | null) => void;
  saveViewpoint: (name: string) => void;
  restoreViewpoint: (id: string) => void;
  deleteViewpoint: (id: string) => void;
  runQualityCheck: () => void;
  updateCamera: (position: Vec3, target: Vec3) => void;
  recalculateRays: () => void;
  regenerateStarField: () => void;
}
