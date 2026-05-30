export interface OperationSegment {
  id?: string;
  deviceId: string;
  startTime: number;
  endTime: number;
  loadLevel: number;
  sampleCount: number;
  avgSpeed: number;
  avgTorque: number;
  maxTorque: number;
  minTorque: number;
  avgTemperature: number;
  maxTemperature: number;
  hasAnomaly: boolean;
  anomalyIds: string[];
  sampleIds: string[];
  createdAt: number;
}

export interface SegmentStatistics {
  totalSegments: number;
  totalDuration: number;
  avgTorqueOverall: number;
  maxTemperatureOverall: number;
  anomalyCount: number;
  segmentsWithAnomaly: number;
}
