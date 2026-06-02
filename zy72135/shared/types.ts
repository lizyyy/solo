export type RecordStatus = 'pending' | 'approved' | 'needs_supplement' | 'obsolete';
export type RecordSource = 'stage_channel' | 'manual' | 'imported_old';

export interface TrackCleanupRecord {
  id: string;
  trackName: string;
  artistName: string;
  status: RecordStatus;
  source: RecordSource;
  hasAuthorization: boolean;
  isDuplicate: boolean;
  isOldMaster: boolean;
  isRenamed: boolean;
  originalTrackName?: string;
  currentNote: string;
  latestHandler: string;
  latestHandleTime: string;
  originalSource: string;
  originalHandleTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface VersionHistory {
  id: string;
  recordId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  modifiedBy: string;
  modifiedAt: string;
}

export interface FilterState {
  status?: RecordStatus;
  source?: RecordSource;
  searchKeyword?: string;
  dateFrom?: string;
  dateTo?: string;
}

export const statusLabels: Record<RecordStatus, string> = {
  pending: '待确认',
  approved: '已通过',
  needs_supplement: '需补充',
  obsolete: '已作废',
};

export const sourceLabels: Record<RecordSource, string> = {
  stage_channel: '舞台通道表',
  manual: '人工补录',
  imported_old: '导入旧记录',
};
