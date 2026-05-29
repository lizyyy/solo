export interface Part {
  id: string;
  name: string;
  category: string;
  totalPages: number;
  pages: number[];
}

export interface PageRule {
  id: string;
  partId: string;
  startPage: number;
  endPage: number;
  exceptions: number[];
}

export interface Musician {
  id: string;
  name: string;
  partId: string;
  role: string;
  email?: string;
}

export interface Revision {
  id: string;
  name: string;
  pageNumber: string;
  partIds: string[];
  issueDate: string;
  description: string;
}

export interface Distribution {
  id: string;
  musicianId: string;
  partId: string;
  pagesReceived: string[];
  revisionIds: string[];
  distributedAt: string;
  distributedBy: string;
}

export interface CheckReport {
  id: string;
  versionId: string;
  checkedAt: string;
  checkedBy: string;
  results: CheckResult[];
  status: 'pending' | 'pass' | 'fail';
}

export interface CheckResult {
  id: string;
  type: 'page' | 'distribution' | 'revision';
  severity: 'error' | 'warning' | 'info';
  partId?: string;
  musicianId?: string;
  revisionId?: string;
  message: string;
  suggestion: string;
  status: 'open' | 'resolved' | 'ignored';
}

export interface SignOff {
  id: string;
  musicianId: string;
  distributionId: string;
  signedAt: string;
  signature: string;
  notes?: string;
}

export interface DataVersion {
  id: string;
  name: string;
  createdAt: string;
  description: string;
  data: AllData;
}

export interface AllData {
  parts: Part[];
  pageRules: PageRule[];
  musicians: Musician[];
  revisions: Revision[];
  distributions: Distribution[];
  checkReports: CheckReport[];
  signOffs: SignOff[];
}

export type ImportDataType = 'parts' | 'pageRules' | 'musicians' | 'revisions' | 'distributions';

export interface DataStoreState {
  currentVersionId: string | null;
  versions: DataVersion[];
  currentData: AllData;
  checkResults: CheckResult[];
  isChecked: boolean;
}

export interface DataStoreActions {
  setCurrentVersion: (versionId: string) => void;
  createVersion: (name: string, description: string, data: Partial<AllData>) => void;
  updateData: (dataType: ImportDataType, data: any[]) => void;
  importSampleData: () => void;
  setCheckResults: (results: CheckResult[]) => void;
  clearData: () => void;
  exportData: () => string;
}

export type DataStore = DataStoreState & DataStoreActions;
