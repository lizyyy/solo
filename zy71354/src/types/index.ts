export type InstallationStatus = 'draft' | 'pending' | 'risk_detected' | 'approved' | 'completed';

export type MaterialType = 'base_drawing' | 'lifting_plan' | 'wind_load_params' | 'on_site_signature' | 'risk_report';

export type RiskLevel = 'safe' | 'warning' | 'critical';

export type RiskType = 'lifting_point_missing' | 'wind_load_exceed' | 'signature_late' | 'other';

export interface SculptureDimensions {
  height: number;
  width: number;
  depth: number;
  weight: number;
}

export interface WindLoadParams {
  windSpeed: number;
  windPressure: number;
  safetyFactor: number;
  maxAllowedWindSpeed: number;
}

export interface LiftingPoint {
  id: string;
  location: string;
  capacity: number;
  position: { x: number; y: number };
}

export interface LiftingPlan {
  points: LiftingPoint[];
  equipment: string;
  operator: string;
  date: string;
}

export interface InstallationBase {
  projectName: string;
  sculptureName: string;
  dimensions: SculptureDimensions;
  plannedInstallationDate: string;
  actualInstallationDate?: string;
}

export interface Installation extends InstallationBase {
  id: string;
  status: InstallationStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface Material {
  id: string;
  installationId: string;
  type: MaterialType;
  name: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  uploadedAt: string;
  version: number;
}

export interface Signature {
  id: string;
  installationId: string;
  signerName: string;
  signerRole: string;
  signatureDate: string;
  signedAt: string;
  version: number;
}

export interface RiskCheck {
  id: string;
  installationId: string;
  type: RiskType;
  level: RiskLevel;
  description: string;
  details: Record<string, any>;
  checkedAt: string;
}

export interface VersionHistory {
  id: string;
  installationId: string;
  version: number;
  changeType: string;
  changedBy: string;
  changedAt: string;
}

export interface RiskReport {
  installationId: string;
  overallLevel: RiskLevel;
  checks: RiskCheck[];
  generatedAt: string;
}
