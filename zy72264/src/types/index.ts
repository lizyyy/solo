export type RowStatus = 'pending' | 'modified' | 'review' | 'archived';
export type ChangeType = 'edit' | 'rollback' | 'auto_detect';

export interface SafetyRadiusRow {
  id: string;
  originalRowNumber: number;
  tunnelName: string;
  coordinateOrigin: string;
  radius: number;
  length: number;
  calculatedLength: number;
  remark: string;
  status: RowStatus;
  importedBatchId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChangeRecord {
  id: string;
  rowId: string;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  changeType: ChangeType;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  totalRows: number;
  duplicatedRows: number;
  abnormalRows: number;
  importedAt: string;
  importedBy: string;
}

export interface CoordinateOriginDoc {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}
