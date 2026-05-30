import type { OperationSegment, Anomaly } from './';

export type ExportFormat = 'pdf' | 'xlsx' | 'json' | 'csv';

export interface ReportSummary {
  totalSamples: number;
  totalSegments: number;
  totalDuration: number;
  avgSpeed: number;
  avgTorque: number;
  maxTorque: number;
  minTorque: number;
  avgTemperature: number;
  maxTemperature: number;
  anomalyCount: number;
  segmentsWithAnomaly: number;
  confirmedAnomalyCount: number;
}

export interface ReportConfig {
  title: string;
  deviceId: string;
  startTime: number;
  endTime: number;
  includeSegments: boolean;
  includeAnomalies: boolean;
  includeRawData: boolean;
  includeCharts: boolean;
  generatedBy: string;
}

export interface AnalysisReport {
  id?: string;
  title: string;
  deviceId: string;
  startTime: number;
  endTime: number;
  generatedBy: string;
  generatedAt: number;
  summary: ReportSummary;
  segments: OperationSegment[];
  anomalies: Anomaly[];
  sampleIdMap: Record<string, string>;
  exportedAt?: number;
  exportedFormat?: ExportFormat;
  config: ReportConfig;
}
