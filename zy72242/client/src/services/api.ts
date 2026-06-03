import axios from 'axios';
import { 
  ReconciliationRecord, 
  ReconciliationRecordWithRelations, 
  TailAdjustment, 
  AuditLog,
  Holiday,
  ReconciliationNoteUpdate,
  TailAdjustmentCreate,
  ReviewCreate,
  ApiResponse,
  DemoStepResult
} from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const recordApi = {
  getAllRecords: (params?: { fundCode?: string; onlyModifications?: boolean }) =>
    api.get<ApiResponse<ReconciliationRecord[]>>('/records', { params }),
  
  getRecordById: (id: string) =>
    api.get<ApiResponse<ReconciliationRecordWithRelations>>(`/records/${id}`),
  
  importRecords: (records: any[], operator: string = '支付平台阿南') =>
    api.post<ApiResponse<any>>('/records/import', { records, operator }),
  
  updateReconciliationNote: (id: string, note: ReconciliationNoteUpdate) =>
    api.put<ApiResponse<ReconciliationRecordWithRelations>>(`/records/${id}/reconciliation`, note),
  
  markAsManualModification: (id: string, data: { actualArrivalDate: string; modifiedBy: string; modificationReason: string }) =>
    api.put<ApiResponse<ReconciliationRecordWithRelations>>(`/records/${id}/mark-modification`, data),
  
  reviewRecord: (id: string, review: ReviewCreate) =>
    api.post<ApiResponse<any>>(`/records/${id}/review`, review),
  
  rerunReconciliation: (id: string, operator: string = '系统') =>
    api.post<ApiResponse<ReconciliationRecordWithRelations>>(`/records/${id}/rerun`, { operator })
};

export const adjustmentApi = {
  getAllAdjustments: () =>
    api.get<ApiResponse<TailAdjustment[]>>('/adjustments'),
  
  getAdjustmentsByRecordId: (recordId: string) =>
    api.get<ApiResponse<TailAdjustment[]>>(`/adjustments/record/${recordId}`),
  
  createAdjustment: (adjustment: TailAdjustmentCreate) =>
    api.post<ApiResponse<TailAdjustment>>('/adjustments', adjustment),
  
  getAdjustmentImpact: (id: string) =>
    api.get<ApiResponse<any>>(`/adjustments/${id}/impact`),
  
  recalculateAll: () =>
    api.post<ApiResponse<any>>('/adjustments/recalculate')
};

export const auditApi = {
  getAllLogs: () =>
    api.get<ApiResponse<AuditLog[]>>('/audit'),
  
  getLogsByRecordId: (recordId: string) =>
    api.get<ApiResponse<AuditLog[]>>(`/audit/record/${recordId}`)
};

export const demoApi = {
  initDemo: (step?: number) =>
    api.get<ApiResponse<DemoStepResult | any>>('/demo/init', { params: step ? { step } : {} }),
  
  getDemoGuide: () =>
    api.get<ApiResponse<any>>('/demo/guide'),
  
  resetDemo: () =>
    api.post<ApiResponse<any>>('/demo/reset'),
  
  getHolidays: () =>
    api.get<ApiResponse<Holiday[]>>('/demo/holidays'),
  
  calculateExpectedDate: (tradeDate: string) =>
    api.get<ApiResponse<any>>('/demo/calculate-expected-date', { params: { tradeDate } })
};

export default api;
