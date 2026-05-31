export interface Team {
  id: string;
  name: string;
  members: string[];
  registrationTime: number;
  submissionCount: number;
}

export type MaterialType = 'param_draft' | 'team_notes' | 'result_chart' | 'boundary_doc';

export interface Material {
  type: MaterialType;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  hasIssue: boolean;
  issueDesc?: string;
}

export type SubmissionStatus = 'queued' | 'processing' | 'success' | 'failed';

export interface Submission {
  id: string;
  teamId: string;
  teamName: string;
  materials: Material[];
  status: SubmissionStatus;
  anomalies: AnomalyRecord[];
  windowId: string | null;
  startTime: number;
  endTime?: number;
  isResubmission: boolean;
  originalSubmissionId?: string;
}

export interface Draft {
  id: string;
  teamId: string;
  content: string;
  version: number;
  modifiedBy: string;
  modifiedAt: number;
  parentVersion?: number;
  changeSummary: string;
  hash: string;
}

export type WindowStatus = 'idle' | 'busy' | 'paused';

export interface Window {
  id: string;
  name: string;
  status: WindowStatus;
  currentSubmissionId: string | null;
  queue: string[];
}

export type AnomalyType = 'missing_notes' | 'duplicate_chart' | 'boundary_case' | 'draft_modified' | 'resubmission';
export type AnomalySeverity = 'info' | 'warning' | 'error';

export interface AnomalyRecord {
  id: string;
  type: AnomalyType;
  severity: AnomalySeverity;
  message: string;
  explanation: string;
  submissionId: string;
  teamId: string;
  timestamp: number;
  handled: boolean;
}

export interface StateSnapshot {
  id: string;
  timestamp: number;
  simulationTime: number;
  windows: Window[];
  submissions: Submission[];
  drafts: Draft[];
  anomalies: AnomalyRecord[];
  previousHash: string;
  hash: string;
}

export interface SimulationConfig {
  windowCount: number;
  processingTimeMs: number;
  autoDetectAnomalies: boolean;
  preserveHistory: boolean;
}

export interface SimulationState {
  config: SimulationConfig;
  windows: Window[];
  teams: Team[];
  submissions: Submission[];
  drafts: Draft[];
  anomalies: AnomalyRecord[];
  snapshots: StateSnapshot[];
  currentUser: string;
  simulationTime: number;
  isRunning: boolean;
  isPaused: boolean;
  speed: number;
  replaySnapshotId: string | null;
}

export interface Coach {
  id: string;
  name: string;
}

export const COACHES: Coach[] = [
  { id: 'coach_zhang', name: '张教练' },
  { id: 'coach_li', name: '李教练' },
  { id: 'coach_wang', name: '王教练' },
  { id: 'coach_zhao', name: '赵教练' },
];
