export interface BuoyRecord {
  id: string;
  buoyId: string;
  recordTime: string;
  latitude: number;
  longitude: number;
  rawLogEntry: {
    latRaw: string;
    lonRaw: string;
    logPage: string;
    logDate: string;
    notes?: string;
  };
  seaState: number;
  waveHeight: number;
  windSpeed: number;
  status: 'pending' | 'reviewed' | 'anomaly' | 'boundary';
  isAnomaly: boolean;
  isBoundary: boolean;
  isCloudOccluded: boolean;
  manualRemark?: string;
  calculationCriteria: {
    formula: string;
    threshold: number;
    version: string;
    calculatedAt: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface LatLonMapping {
  id: string;
  buoyId: string;
  rawFormat: string;
  standardLat: number;
  standardLon: number;
  rawLatExample: string;
  rawLonExample: string;
  description: string;
  createdAt: string;
}

export interface CloudOcclusionSuggestion {
  id: string;
  recordId: string;
  suggestion: string;
  severity: 'low' | 'medium' | 'high';
  referenceDoc: string;
}

export interface Statistics {
  total: number;
  pending: number;
  reviewed: number;
  anomaly: number;
  boundary: number;
  cloudOccluded: number;
  seaStateDistribution: { level: number; count: number }[];
}

export interface DeduplicateResult {
  added: number;
  updated: number;
  skipped: number;
}

export type TabType = 'import' | 'mapping' | 'boundary' | 'cloud';
