export type InstrumentType = 'drums' | 'bass' | 'vocals' | 'guitar' | 'keys';
export type MicType = 'dynamic' | 'condenser';
export type IssueType = 'source_overlap' | 'missing_monitor' | 'volume_imbalance';
export type IssueSeverity = 'warning' | 'error';
export type SelectedObjectType = 'musician' | 'microphone' | 'monitor' | null;

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface Musician {
  id: string;
  planId: string;
  type: InstrumentType;
  name: string;
  position: Vector3;
  rotation: number;
  sourceLevel: number;
  directivity: number;
  color: string;
}

export interface Microphone {
  id: string;
  planId: string;
  name: string;
  type: MicType;
  position: Vector3;
  rotation: Vector3;
  gain: number;
  targetMusicianId?: string;
}

export interface MonitorPoint {
  id: string;
  planId: string;
  name: string;
  position: Vector3;
}

export interface RoomConfig {
  id: string;
  planId: string;
  length: number;
  width: number;
  height: number;
  wallMaterial: string;
  reverbTime: number;
  ambientNoise: number;
}

export interface SoundPressureSample {
  position: Vector3;
  level: number;
}

export interface SceneIssueDetails {
  suggestion?: string;
  distance?: number;
  threshold?: number;
  ratio?: number;
  musician1?: { id: string; name: string };
  musician2?: { id: string; name: string };
  [key: string]: unknown;
}

export interface SceneIssue {
  id: string;
  planId: string;
  type: IssueType;
  severity: IssueSeverity;
  message: string;
  suggestion?: string;
  details: SceneIssueDetails;
  detectedAt: Date;
  relatedObjectIds: string[];
}

export interface RehearsalReport {
  id: string;
  planId: string;
  createdAt: Date;
  overallScore: number;
  volumeBalanceScore: number;
  monitorReadings: Record<string, number>;
  summary: {
    totalMusicians: number;
    totalMicrophones: number;
    totalMonitorPoints: number;
    averageSoundPressure: number;
    volumeBalanceScore: number;
  };
  issues: SceneIssue[];
  suggestions: string[];
  heatmapData: SoundPressureSample[];
}

export interface RehearsalPlan {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  version: number;
  isSaved: boolean;
  musicianCount?: number;
  monitorCount?: number;
  issueCount?: number;
}

export interface CompletePlanData {
  plan: RehearsalPlan;
  musicians: Musician[];
  microphones: Microphone[];
  monitorPoints: MonitorPoint[];
  roomConfig: RoomConfig;
  reports: RehearsalReport[];
}

export interface AppState {
  currentPlanId: string | null;
  plan: RehearsalPlan | null;
  musicians: Musician[];
  microphones: Microphone[];
  monitorPoints: MonitorPoint[];
  roomConfig: RoomConfig | null;
  reports: RehearsalReport[];
  sceneIssues: SceneIssue[];
  selectedObjectId: string | null;
  selectedObjectType: SelectedObjectType;
  showHeatmap: boolean;
  heatmapData: SoundPressureSample[];
  savedPlans: RehearsalPlan[];
  uiState: {
    sidebarOpen: boolean;
    activeTab: string;
    showReportModal: boolean;
    showLoadModal: boolean;
  };
}
