export type RecordStatus = "normal" | "anomalous" | "boundary";

export interface SamplePack {
  id: string;
  name: string;
  hasBoundary: boolean;
  description: string;
}

export interface DetectionRecord {
  id: string;
  packId: string;
  batchId: string;
  detectTime: string;
  timeWindow: string;
  rawValue: number;
  status: RecordStatus;
  deviation?: number;
  contribution?: number;
  anomalyReason?: string;
  isStrongPull?: boolean;
}

export interface MaterialBatch {
  batchId: string;
  supplier: string;
  inboundDate: string;
  materialType: string;
  sameBatchAnomalies: number;
  notes?: string;
}

export interface TimeBinAggregate {
  window: string;
  mean: number;
  robustMean: number;
  count: number;
  anomalousCount: number;
  boundaryCount: number;
  hasStrongPull: boolean;
  recordIds: string[];
}

export interface AlgoResult {
  records: DetectionRecord[];
  bins: TimeBinAggregate[];
  summary: {
    total: number;
    anomalous: number;
    boundary: number;
    normal: number;
    strongPullCount: number;
    maxContribution: number;
  };
}
