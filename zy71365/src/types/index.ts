export type CompletionLevel = 1 | 2 | 3 | 4 | 5;

export type AnomalyType = 'duplicate_theme' | 'low_completion' | 'missing_copyright';

export type Severity = 'warning' | 'critical';

export type SourceMaterialType = 'image' | 'document' | 'reference';

export type ApplicationDirection = '视觉传达' | '产品设计' | '交互设计' | '纯艺术' | '服装设计' | '建筑设计';

export interface Copyright {
  hasClearance: boolean;
  source: string;
  notes: string;
}

export interface SourceMaterial {
  id: string;
  type: SourceMaterialType;
  title: string;
  url: string;
  uploadedAt: string;
}

export interface StudentWork {
  id: string;
  title: string;
  studentName: string;
  thumbnail: string;
  description: string;
  tags: string[];
  mediums: string[];
  completion: CompletionLevel;
  applicationDirection: ApplicationDirection[];
  copyright: Copyright;
  createdAt: string;
  sourceMaterials: SourceMaterial[];
}

export interface Anomaly {
  id: string;
  type: AnomalyType;
  severity: Severity;
  description: string;
  relatedWorkIds: string[];
  createdAt: string;
}

export interface FilterCriteria {
  tags: string[];
  mediums: string[];
  minCompletion: number;
  applicationDirection: ApplicationDirection | null;
}

export interface PortfolioScore {
  overall: number;
  dimensions: {
    themeDiversity: number;
    mediumRichness: number;
    completionBalance: number;
    copyrightCompliance: number;
    directionMatch: number;
    qualityLevel: number;
  };
}

export interface ScreeningSession {
  id: string;
  name: string;
  criteria: FilterCriteria;
  selectedWorkIds: string[];
  score: PortfolioScore;
  anomalies: Anomaly[];
  createdAt: string;
  note: string;
}

export interface ScreeningReport {
  summary: {
    totalWorks: number;
    selectedWorks: number;
    overallScore: number;
    anomalyCount: number;
    recommendation: string;
  };
  details: StudentWork[];
  anomalies: Anomaly[];
  exportedAt: string;
}

export interface PortfolioState {
  works: StudentWork[];
  selectedWorkIds: string[];
  filterCriteria: FilterCriteria;
  anomalies: Anomaly[];
  sessions: ScreeningSession[];
  currentScore: PortfolioScore | null;
}

export interface PortfolioActions {
  setWorks: (works: StudentWork[]) => void;
  setFilterCriteria: (criteria: Partial<FilterCriteria>) => void;
  toggleWorkSelection: (workId: string) => void;
  selectAllFiltered: () => void;
  clearSelection: () => void;
  calculateScore: () => void;
  detectAnomalies: () => void;
  saveSession: (name: string, note: string) => void;
  loadSession: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  resetToSession: (session: ScreeningSession) => void;
}
