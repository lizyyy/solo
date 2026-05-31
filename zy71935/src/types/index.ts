export type MaterialType = 'text' | 'image' | 'color' | 'layout';

export type ChangeType = 'material' | 'conclusion';

export type Severity = 'low' | 'medium' | 'high';

export type IssueType = 'error' | 'warning' | 'info';

export type TaskStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface MaterialFile {
  id: string;
  name: string;
  type: MaterialType;
  content: string;
  uploadTime: number;
  version: string;
  hash?: string;
}

export interface ChangeRecord {
  id: string;
  fileId: string;
  field: string;
  oldValue: string;
  newValue: string;
  type: ChangeType;
  category: string;
  severity: Severity;
  description: string;
  suggestion: string;
  timestamp: number;
}

export interface ProofreadIssue {
  id: string;
  fileId: string;
  type: IssueType;
  title: string;
  message: string;
  suggestion: string;
  location: {
    line?: number;
    field?: string;
  };
  resolved: boolean;
}

export interface ScreenRange {
  scrollTop: number;
  scrollHeight: number;
  visibleStart: number;
  visibleEnd: number;
  timestamp: number;
}

export interface FilterState {
  searchText: string;
  changeTypes: string[];
  severities: string[];
  resolvedStatus: string;
  sortBy: string;
}

export interface ExportConfig {
  format: 'pdf' | 'docx' | 'markdown';
  includeScreenRange: boolean;
  includeFilters: boolean;
  template: string;
  timestamp: number;
}

export interface ProofreadTask {
  id: string;
  name: string;
  status: TaskStatus;
  files: MaterialFile[];
  changes: ChangeRecord[];
  issues: ProofreadIssue[];
  screenRange: ScreenRange;
  filters: FilterState;
  createdAt: number;
  updatedAt: number;
  processedHash?: string;
}

export interface AppState {
  currentTask: ProofreadTask | null;
  tasks: ProofreadTask[];
  batchQueue: string[];
  batchProcessing: boolean;
  screenRange: ScreenRange;
  filters: FilterState;
  setCurrentTask: (task: ProofreadTask | null) => void;
  addFile: (file: MaterialFile) => void;
  runProofread: () => Promise<void>;
  runBatchProofread: (taskIds: string[]) => Promise<void>;
  resolveIssue: (issueId: string) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  setScreenRange: (range: ScreenRange) => void;
  exportReport: (config: ExportConfig) => Promise<string>;
  resetState: () => void;
  createNewTask: (name: string) => void;
  loadSampleData: () => void;
}
