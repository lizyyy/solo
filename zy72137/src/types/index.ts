export interface SampleRecord {
  id: string;
  originalFileName: string;
  trackName: string;
  sourcePath: string;
  authorizationStatus: "valid" | "expired" | "missing" | "unknown";
  authorizationExpiry: string | null;
  timecodeStart: string | null;
  timecodeEnd: string | null;
  duration: number | null;
  isDuplicate: boolean;
  duplicateGroupId: string | null;
  isOldMaster: boolean;
  isManualRename: boolean;
  hasTimecodeIssue: boolean;
  userNote: string;
  originalImportBatch: string;
  createdAt: string;
  updatedAt: string;
}

export interface DiffLogEntry {
  id: string;
  operationType: "import" | "note_edit" | "status_change" | "merge";
  targetRecordId: string | null;
  description: string;
  beforeValue: string | null;
  afterValue: string | null;
  timestamp: string;
}

export interface FilterState {
  authorizationStatus: string[];
  issueTypes: string[];
  dateRange: { start: string | null; end: string | null };
  keyword: string;
}

export type IssueType = "expired" | "timecode" | "duplicate";
