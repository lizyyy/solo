export type DataSource = 'student' | 'score_sheet' | 'manual' | 'script_mod';

export type StepStatus = 'completed' | 'skipped' | 'pending';

export type ExperimentStatus = 'normal' | 'pending_score' | 'has_anomaly' | 'incomplete';

export type AnomalyType = 'step_skip' | 'conclusion_diff' | 'timing_diff' | 'missing_data';

export interface Experiment {
  id: string;
  className: string;
  studentName: string;
  studentId: string;
  experimentDate: string;
  status: ExperimentStatus;
  studentRecordArrivedAt: string;
  scoreSheetArrivedAt?: string;
  currentScriptVersion: string;
  anomalyCount: number;
  pendingCount: number;
}

export interface StepRecord {
  id: string;
  experimentId: string;
  stepNumber: number;
  stepName: string;
  content: string;
  actualOccurredAt: string;
  recordedAt: string;
  source: DataSource;
  isSupplementary: boolean;
  status: StepStatus;
  skipReason?: string;
  skipSource?: DataSource;
  operator?: string;
}

export interface ScoreSheet {
  id: string;
  experimentId: string;
  totalScore: number;
  conclusion: string;
  originalConclusion?: string;
  grader: string;
  gradedAt: string;
  conclusionChangeReason?: string;
  conclusionChanged: boolean;
  stepScores: { stepNumber: number; score: number; comment?: string }[];
}

export interface ScriptVersion {
  id: string;
  experimentId: string;
  version: string;
  content: string;
  changeReason: string;
  modifiedBy: string;
  modifiedAt: string;
  parentVersion?: string;
}

export interface Anomaly {
  id: string;
  experimentId: string;
  type: AnomalyType;
  description: string;
  source: DataSource;
  responsiblePerson: string;
  nextAction: string;
  resolved: boolean;
  relatedStepNumber?: number;
  createdAt: string;
}

export interface TimelineItem {
  id: string;
  experimentId: string;
  stepNumber: number;
  stepName: string;
  content: string;
  actualOccurredAt: string;
  recordedAt: string;
  source: DataSource;
  isSupplementary: boolean;
  status: StepStatus;
  skipReason?: string;
  timeGap?: string;
}

export const sourceLabels: Record<DataSource, { label: string; color: string }> = {
  student: { label: '学生记录', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  score_sheet: { label: '评分表', color: 'bg-green-100 text-green-800 border-green-200' },
  manual: { label: '手工补录', color: 'bg-gray-100 text-gray-600 border-gray-300 italic' },
  script_mod: { label: '脚本修改', color: 'bg-purple-100 text-purple-800 border-purple-200' },
};

export const statusLabels: Record<StepStatus, { label: string; color: string }> = {
  completed: { label: '完成', color: 'bg-green-500' },
  skipped: { label: '跳过', color: 'bg-red-500' },
  pending: { label: '待补', color: 'bg-orange-500' },
};

export const experimentStatusLabels: Record<ExperimentStatus, { label: string; color: string }> = {
  normal: { label: '正常', color: 'bg-green-500' },
  pending_score: { label: '待补评分表', color: 'bg-orange-500' },
  has_anomaly: { label: '有异常', color: 'bg-red-500' },
  incomplete: { label: '不完整', color: 'bg-gray-500' },
};
