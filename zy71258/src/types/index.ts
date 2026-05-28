export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Wall {
  id: string;
  start: Point3D;
  end: Point3D;
  height: number;
  thickness: number;
  material: string;
  opacity: number;
}

export interface Gallery {
  id: string;
  name: string;
  width: number;
  height: number;
  depth: number;
  walls: Wall[];
  material: string;
  createdBy: string;
  createdAt: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

export type LightSourceType = 'spot' | 'point' | 'directional' | 'area';

export interface LightSource {
  id: string;
  galleryId: string;
  name: string;
  type: LightSourceType;
  power: number;
  intensity: number;
  posX: number;
  posY: number;
  posZ: number;
  angleX: number;
  angleY: number;
  angleZ: number;
  beamAngle: number;
  colorTemperature: number;
  spectrumDistribution?: Record<string, number>;
  calibrationCertNo?: string;
  calibrationDate?: string;
  createdBy: string;
  createdAt: string;
}

export type LightResistanceGrade = 
  | 'ISO 15426 Grade 1'
  | 'ISO 15426 Grade 2'
  | 'ISO 15426 Grade 3'
  | 'ISO 15426 Grade 4';

export interface Artwork {
  id: string;
  galleryId: string;
  exhibitionId?: string;
  registrationNo: string;
  name: string;
  lightResistanceGrade: LightResistanceGrade;
  posX: number;
  posY: number;
  posZ: number;
  width: number;
  height: number;
  protectionLevel: string;
  currentIllumination?: number;
  cumulativeExposure?: number;
  createdBy: string;
  createdAt: string;
  lastModifiedBy?: string;
  lastModifiedAt?: string;
}

export interface SamplingPoint {
  id: string;
  galleryId: string;
  name: string;
  posX: number;
  posY: number;
  posZ: number;
}

export interface SamplingData {
  id: string;
  samplingPointId: string;
  measuredValue: number;
  measuredAt: string;
  instrumentId: string;
  instrumentCalibrationStatus: 'valid' | 'expired' | 'unknown';
  measuredBy: string;
}

export interface Exhibition {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  dailyOpenHours: number;
  approvalNo?: string;
  responsiblePerson: string;
  status: 'planning' | 'ongoing' | 'ended';
  createdBy: string;
  createdAt: string;
}

export type RiskType = 'over_illumination' | 'cumulative_leak' | 'light_penetration';
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskStatus = 'detected' | 'acknowledged' | 'resolved';

export interface Risk {
  id: string;
  type: RiskType;
  severity: RiskSeverity;
  status: RiskStatus;
  description: string;
  posX: number;
  posY: number;
  posZ: number;
  artworkId?: string;
  lightSourceId?: string;
  measuredValue: number;
  threshold: number;
  exceedRatio: number;
  evidence: {
    screenshotRef?: string;
    samplingDataRef?: string;
    notes?: string;
  };
  detectedAt: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  resolution?: string;
}

export interface ProtectionReport {
  id: string;
  exhibitionId: string;
  reportNo: string;
  generatedAt: string;
  riskSummary: {
    totalRisks: number;
    overIllumination: number;
    cumulativeLeak: number;
    lightPenetration: number;
    bySeverity: Record<RiskSeverity, number>;
  };
  recommendations: Array<{
    artworkId?: string;
    artworkName?: string;
    suggestion: string;
    priority: 'high' | 'medium' | 'low';
  }>;
  screenshots: Array<{
    dataUrl: string;
    caption: string;
    timestamp: string;
  }>;
  dataSources: Array<{
    type: string;
    count: number;
    lastUpdated: string;
  }>;
  generatedBy: string;
  digitalSignature?: string;
}

export interface LightResistanceThreshold {
  maxAnnualExposure: number;
  maxInstantIllumination: number;
  colorTemperatureLimit: number;
}

export interface CumulativeExposureResult {
  totalExposure: number;
  calculatedExposure: number;
  actualExposure: number;
  leakageDays: string[];
  exposureByDay: Array<{ date: string; exposure: number }>;
}

export interface RelayoutPreviewRequest {
  artworkId: string;
  newPosition: Point3D;
  galleryId: string;
}

export interface RelayoutPreviewResponse {
  originalPosition: Point3D;
  newPosition: Point3D;
  originalIllumination: number;
  newIllumination: number;
  originalRiskLevel: RiskSeverity;
  newRiskLevel: RiskSeverity;
  improvement: number;
  recommendation: string;
  warnings: string[];
}

export interface IlluminationSample {
  position: Point3D;
  value: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, string>;
  };
  timestamp: string;
  requestId: string;
}

export interface RiskDetectionRequest {
  galleryId: string;
  exhibitionId: string;
  includeRayTracing?: boolean;
}

export interface RiskDetectionResponse {
  summary: {
    totalRisks: number;
    overIllumination: number;
    cumulativeLeak: number;
    lightPenetration: number;
  };
  risks: Risk[];
  timestamp: string;
  calculationTimeMs: number;
}

export type DataSourceType = 
  | 'gallery' 
  | 'lightSource' 
  | 'artwork' 
  | 'sampling' 
  | 'exhibition' 
  | 'report';

export const LIGHT_RESISTANCE_THRESHOLDS: Record<LightResistanceGrade, LightResistanceThreshold> = {
  'ISO 15426 Grade 1': {
    maxAnnualExposure: 50000,
    maxInstantIllumination: 50,
    colorTemperatureLimit: 3000
  },
  'ISO 15426 Grade 2': {
    maxAnnualExposure: 200000,
    maxInstantIllumination: 200,
    colorTemperatureLimit: 4000
  },
  'ISO 15426 Grade 3': {
    maxAnnualExposure: 500000,
    maxInstantIllumination: 500,
    colorTemperatureLimit: 6500
  },
  'ISO 15426 Grade 4': {
    maxAnnualExposure: 1000000,
    maxInstantIllumination: 1000,
    colorTemperatureLimit: 6500
  }
};

export const GRADE_COLORS: Record<LightResistanceGrade, string> = {
  'ISO 15426 Grade 1': '#E5484D',
  'ISO 15426 Grade 2': '#F2994A',
  'ISO 15426 Grade 3': '#27AE60',
  'ISO 15426 Grade 4': '#2F80ED'
};

export const RISK_COLORS: Record<RiskType, string> = {
  over_illumination: '#E5484D',
  cumulative_leak: '#F2994A',
  light_penetration: '#9B51E0'
};

export const SEVERITY_COLORS: Record<RiskSeverity, string> = {
  low: '#27AE60',
  medium: '#F2994A',
  high: '#E67E22',
  critical: '#E5484D'
};
