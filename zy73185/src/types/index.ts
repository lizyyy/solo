export interface DraftEntry {
  id: string;
  questionNo: string;
  answerContent: string;
  answerVersion?: string;
  supplementaryNote?: string;
  rawSource: string;
  submittedAt: number;
  submissionFingerprint: string;
}

export interface ParamVersion {
  id: string;
  name: string;
  createdAt: number;
  tolerance: number;
  roundingRule: "round" | "floor" | "ceil";
  sigFigs: number;
  isActive: boolean;
}

export type AnomalyType =
  | "answer_version_conflict"
  | "duplicate_submission"
  | "duplicate_sample"
  | "missing_note";

export interface Anomaly {
  id: string;
  type: AnomalyType;
  relatedDraftIds: string[];
  sourceDescription: string;
  impactScope: string;
  explanation: string;
  resolved: boolean;
  resolverNote?: string;
}

export interface CalculationRun {
  id: string;
  paramVersionId: string;
  startedAt: number;
  finishedAt: number;
  draftIds: string[];
  anomalies: Anomaly[];
  summary: string;
  editorNote?: string;
}

export interface AppState {
  drafts: DraftEntry[];
  paramVersions: ParamVersion[];
  activeParamVersionId: string | null;
  runs: CalculationRun[];
  currentAnomalies: Anomaly[];
  globalSummary: string;
}
