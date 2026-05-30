export interface Hall {
  id: string;
  name: string;
  width: number;
  depth: number;
  height: number;
  wallBounds: [number, number, number, number, number, number];
}

export interface ReflectSurface {
  id: string;
  hallId: string;
  name: string;
  angle: number;
  position: [number, number, number];
  size: [number, number];
  normal: [number, number, number];
}

export interface SoundSource {
  id: string;
  hallId: string;
  name: string;
  position: [number, number, number];
}

export interface SeatZone {
  id: string;
  hallId: string;
  name: string;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  zoneType: 'orchestra' | 'mezzanine' | 'balcony' | 'vip';
}

export interface ReflectPath {
  id: string;
  sourceId: string;
  surfaceId: string;
  zoneId: string;
  pathPoints: [number, number, number][];
}

export interface FrequencyPoint {
  id: string;
  pathId: string;
  frequency: number;
  spl: number;
}

export interface FrequencyCoverage {
  id: string;
  zoneId: string;
  frequency: number;
  coveragePercent: number;
  avgSPL: number;
}

export type AnomalyType = 'SURFACE_THROUGH_WALL' | 'ZONE_MAPPING_ERROR' | 'FREQUENCY_MISSING';
export type AnomalySeverity = 'critical' | 'warning' | 'info';
export type AnomalyStatus = 'pending' | 'confirmed' | 'dismissed';

export interface TraceLink {
  entity: string;
  id: string;
  label: string;
}

export interface AnomalyRecord {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  sourceType: 'ReflectSurface' | 'SeatZone' | 'FrequencyPoint';
  sourceId: string;
  description: string;
  status: AnomalyStatus;
  traceChain: TraceLink[];
}

export interface ImpactAssessment {
  id: string;
  anomalyId: string;
  budgetImpact: 'none' | 'low' | 'medium' | 'high';
  scheduleImpact: 'none' | 'low' | 'medium' | 'high';
  rosterImpact: 'none' | 'low' | 'medium' | 'high';
  detail: string;
}

export interface PreviewReport {
  id: string;
  hallId: string;
  createdAt: string;
  status: 'draft' | 'final';
  anomalyIds: string[];
  coverageIds: string[];
}

export interface Scheme {
  id: string;
  name: string;
  surfaceAngles: Record<string, number>;
  sourcePosition: [number, number, number];
}

export type SelectionType = 'hall' | 'surface' | 'source' | 'zone' | 'path' | 'anomaly' | null;

export interface Selection {
  type: SelectionType;
  id: string | null;
}
