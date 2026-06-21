import os

files = {}

files['src/types/index.ts'] = """export interface ExperimentBucket {
  id: string;
  name: string;
  importTime: string;
  importUser: string;
  hash: string;
  data: Record<string, unknown>;
}

export interface NegativeSample {
  id: string;
  bucketId: string;
  content: string;
  remark: string;
  createTime: string;
}

export type ReportStatus = 'normal' | 'pending_review' | 'reviewed';

export interface ConfidenceReport {
  id: string;
  bucketId: string;
  name: string;
  status: ReportStatus;
  createTime: string;
  updateTime: string;
  currentVersion: string;
  hasTimeWindowIssue: boolean;
  workflowStep: number;
  conclusion: string;
}

export interface ReportVersion {
  id: string;
  reportId: string;
  version: string;
  remarkBefore: string;
  remarkAfter: string;
  modifyUser: string;
  modifyTime: string;
  diff: string;
}

export type AnomalyStatus = 'open' | 'in_progress' | 'resolved';

export interface AnomalySample {
  id: string;
  reportId: string;
  sampleId: string;
  reason: string;
  missingMaterials: string;
  nextOwner: string;
  nextAction: string;
  status: AnomalyStatus;
  createTime: string;
}

export interface CalculationParam {
  id: string;
  reportId: string;
  paramName: string;
  paramValue: string;
  version: string;
  tradeOffReason: string;
  createTime: string;
}

export interface VisualizationDataPoint {
  id: string;
  x: number;
  y: number;
  z?: number;
  confidence: number;
  label: string;
  sourceType: 'bucket' | 'negative_sample';
  sourceId: string;
  hasTimeWindowIssue?: boolean;
}
"""

for path, content in files.items():
    with open(path, 'w') as f:
        f.write(content)
    print(f'Written {path}: {len(content)} bytes, {content.count(chr(10))} lines')
