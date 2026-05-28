import { Bill, AuditLog, FileUploadItem, ImportResult } from './bill';

export interface BillStore {
  bills: Bill[];
  auditLogs: AuditLog[];
  uploadFiles: FileUploadItem[];
  selectedBillId: string | null;
  isLoading: boolean;
  error: string | null;
  
  setBills: (bills: Bill[]) => void;
  addBill: (bill: Bill) => void;
  updateBill: (id: string, updates: Partial<Bill>) => void;
  deleteBill: (id: string) => void;
  selectBill: (id: string | null) => void;
  
  addAuditLog: (log: Omit<AuditLog, 'id' | 'timestamp'>) => void;
  addUploadFile: (item: FileUploadItem) => void;
  updateUploadFile: (fileName: string, updates: Partial<FileUploadItem>) => void;
  clearUploadFiles: () => void;
  
  importBills: (result: ImportResult, sourceFile: string) => Promise<void>;
  recalculateOccupancy: () => void;
  checkExceptions: () => void;
  checkMaturityReminders: () => void;
  
  loadFromStorage: () => void;
  saveToStorage: () => void;
  clearAll: () => void;
}

export interface DashboardStats {
  totalBills: number;
  pledgedBills: number;
  maturedBills: number;
  releasedBills: number;
  pendingBills: number;
  toConfirmBills: number;
  totalMargin: number;
  totalOccupancy: number;
  exceptionCount: number;
  highSeverityCount: number;
  matureThisWeek: number;
  matureNextWeek: number;
}
