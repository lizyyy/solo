export interface VRSession {
  id: string;
  sessionName: string;
  playerId: string;
  startTime: number;
  duration: number;
  gameVersion: string;
  importedAt: number;
  status: 'processing' | 'ready' | 'error';

  accelerationDataId: string;
  frameDataId: string;
  poseDataId: string;
  feedbackIds: string[];
  segmentIds: string[];
  anomalyIds: string[];
}

export interface AccelerationSample {
  timestamp: number;
  linearAccel: { x: number; y: number; z: number };
  angularVel: { x: number; y: number; z: number };
  jerk: { x: number; y: number; z: number };
  magnitude: number;
}

export interface FrameSample {
  timestamp: number;
  fps: number;
  frameTime: number;
  droppedFrames: number;
}

export interface PoseSample {
  timestamp: number;
  position: { x: number; y: number; z: number };
  rotation: { pitch: number; yaw: number; roll: number };
}

export type FeedbackType = 'nausea' | 'dizziness' | 'discomfort' | 'other';

export interface PlayerFeedback {
  id: string;
  sessionId: string;
  timestamp: number;
  type: FeedbackType;
  severity: 1 | 2 | 3 | 4 | 5;
  description: string;
  syncOffset: number;
}

export interface CameraSegment {
  id: string;
  sessionId: string;
  startTime: number;
  endTime: number;
  segmentName: string;
  levelName: string;
  cameraMode: string;
  movementType: string;
  color: string;
}

export type AnomalyType = 'high_accel' | 'high_jerk' | 'fps_drop' | 'pose_jump' | 'player_reported';
export type SeverityLevel = 'low' | 'medium' | 'high' | 'critical';
export type ReviewStatus = 'pending' | 'confirmed' | 'false_positive' | 'needs_review';
export type DominantAxis = 'x' | 'y' | 'z' | 'combined';

export interface AnomalyEvent {
  id: string;
  sessionId: string;
  startTime: number;
  endTime: number;
  peakTime: number;

  type: AnomalyType;
  severity: SeverityLevel;
  riskScore: number;
  confidence: number;

  peakAcceleration: number;
  avgAcceleration: number;
  duration: number;
  frequency: number;
  dominantAxis: DominantAxis;

  reviewStatus: ReviewStatus;
  reviewNotes: string;
  reviewedBy: string;
  reviewedAt: number;

  matchedRules: string[];
  sourceMaterials: SourceMaterial[];
}

export type MaterialType = 'log' | 'video' | 'screenshot' | 'questionnaire' | 'telemetry';

export interface SourceMaterial {
  id: string;
  type: MaterialType;
  name: string;
  url: string;
  startTime: number;
  endTime: number;
}

export type RuleCategory = 'acceleration' | 'jerk' | 'fps' | 'pose' | 'feedback';

export interface RuleConfig {
  id: string;
  name: string;
  description: string;
  category: RuleCategory;

  thresholds: {
    minValue?: number;
    maxValue?: number;
    duration?: number;
    consecutiveSamples?: number;
  };

  weight: number;
  severityMapping: Record<SeverityLevel, number>;

  explanation: string;
  references: string[];

  enabled: boolean;
  isPreset: boolean;
}

export type NormalizationType = 'linear' | 'log' | 'sqrt';

export interface RiskScoreFormula {
  version: string;
  description: string;
  components: {
    ruleId: string;
    weight: number;
    normalization: NormalizationType;
  }[];
  explanation: string;
}

export interface SessionSummary {
  id: string;
  sessionName: string;
  playerId: string;
  duration: number;
  anomalyCount: number;
  highRiskCount: number;
  avgRiskScore: number;
  maxRiskScore: number;
  status: 'processing' | 'ready' | 'error';
  importedAt: number;
}

export interface DashboardStats {
  totalSessions: number;
  totalAnomalies: number;
  highRiskPercentage: number;
  needsReviewCount: number;
  avgRiskScore: number;
}

export interface AnomalyDistributionPoint {
  range: string;
  count: number;
  risk: number;
}

export interface TrendPoint {
  date: string;
  sessionCount: number;
  avgRisk: number;
  anomalyCount: number;
}
