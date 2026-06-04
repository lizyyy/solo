export interface ParameterRecord {
  id: string;
  name: string;
  value: number;
  constraint: string;
}

export interface ParameterTable {
  id: string;
  name: string;
  version: string;
  importedAt: string;
  importedBy: string;
  records: ParameterRecord[];
  hash: string;
}

export type AnswerStatus = 'pending' | 'reviewing' | 'normal' | 'exception';

export interface StudentAnswer {
  id: string;
  studentId: string;
  studentName: string;
  version: number;
  content: string;
  status: AnswerStatus;
  remark: string;
  createdAt: string;
  manualExample?: string;
}

export type HistoryTargetType = 'answer' | 'parameter';

export interface HistoryRecord {
  id: string;
  targetId: string;
  targetType: HistoryTargetType;
  fieldName: string;
  oldValue: string;
  newValue: string;
  operator: string;
  operatedAt: string;
}

export type NextStep = 'business' | 'research';

export interface ErrorItem {
  id: string;
  description: string;
  reason: string;
  missingMaterials: string[];
  nextStep: NextStep;
  kept: boolean;
}

export interface MealPlanResult {
  id: string;
  parameterVersion: string;
  calculationReason: string;
  result: Record<string, number>;
  errors: ErrorItem[];
  createdAt: string;
}

export interface VisualizationData {
  x: number;
  y: number;
  z: number;
  answerId: string;
  studentName: string;
  value: number;
}
