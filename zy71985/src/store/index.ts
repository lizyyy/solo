import { create } from 'zustand';
import type {
  InventoryRecord,
  OperationLog,
  PermissionChange,
  AppFilters,
  RecordStatus,
  OperationAction,
  RecordSource,
  ExportReport,
} from '@/types';
import {
  generateId,
  generateIdempotentKey,
  formatDateTime,
  compareObjects,
  validateRecord,
  calculateCompletionRate,
  generateSuggestions,
  getTodayDateString,
  exportToJson,
  exportToExcel,
} from '@/utils';
import {
  initializeData,
  loadRecords,
  saveRecords,
  loadOperationLogs,
  saveOperationLogs,
  loadPermissionChanges,
  savePermissionChanges,
} from '@/utils/storage';

interface AppState {
  records: InventoryRecord[];
  operationLogs: OperationLog[];
  permissionChanges: PermissionChange[];
  filters: AppFilters;
  selectedRecordId?: string;
  currentUser: string;

  init: () => void;
  addRecord: (record: Omit<InventoryRecord, 'id' | 'createdAt' | 'updatedAt'>) => { success: boolean; errors?: string[] };
  updateRecord: (id: string, updates: Partial<InventoryRecord>, reason: string) => { success: boolean; errors?: string[] };
  updateRecordStatus: (id: string, status: RecordStatus, reason: string) => void;
  importRecords: (records: Partial<InventoryRecord>[], operator: string) => { success: number; failed: number; errors: string[] };
  changePermission: (recordId: string, beforePerm: Record<string, any>, afterPerm: Record<string, any>, reason: string) => void;
  generateExportReport: () => ExportReport;
  exportReportJson: (report: ExportReport) => void;
  exportReportExcel: (report: ExportReport) => void;
  setFilters: (filters: AppFilters) => void;
  setSelectedRecord: (id: string | undefined) => void;
  setCurrentUser: (name: string) => void;
  getRecordById: (id: string) => InventoryRecord | undefined;
  getLogsByRecordId: (recordId: string) => OperationLog[];
  getPermissionChangesByRecordId: (recordId: string) => PermissionChange[];
  getIdempotentInvalidRecords: () => InventoryRecord[];
  getFilteredRecords: () => InventoryRecord[];
}

export const useAppStore = create<AppState>((set, get) => ({
  records: [],
  operationLogs: [],
  permissionChanges: [],
  filters: {},
  selectedRecordId: undefined,
  currentUser: '平台开发',

  init: () => {
    initializeData();
    set({
      records: loadRecords(),
      operationLogs: loadOperationLogs(),
      permissionChanges: loadPermissionChanges(),
    });
  },

  addRecord: (recordData) => {
    const validation = validateRecord(recordData);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const now = formatDateTime(new Date());
    const newRecord: InventoryRecord = {
      ...recordData,
      id: generateId(),
      idempotentKey: recordData.idempotentKey || generateIdempotentKey(recordData.rawData || {}),
      idempotentValid: recordData.idempotentValid ?? true,
      createdAt: now,
      updatedAt: now,
    } as InventoryRecord;

    const newLog: OperationLog = {
      id: generateId(),
      recordId: newRecord.id,
      action: 'create',
      operator: get().currentUser,
      reason: '手动创建记录',
      afterData: { ...newRecord },
      createdAt: now,
    };

    const newRecords = [...get().records, newRecord];
    const newLogs = [...get().operationLogs, newLog];

    saveRecords(newRecords);
    saveOperationLogs(newLogs);

    set({ records: newRecords, operationLogs: newLogs });
    return { success: true };
  },

  updateRecord: (id, updates, reason) => {
    const { records, operationLogs, currentUser } = get();
    const recordIndex = records.findIndex(r => r.id === id);

    if (recordIndex === -1) {
      return { success: false, errors: ['记录不存在'] };
    }

    const oldRecord = records[recordIndex];
    const updatedRecord = { ...oldRecord, ...updates, updatedAt: formatDateTime(new Date()) };

    const validation = validateRecord(updatedRecord);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    const diff = compareObjects(oldRecord, updatedRecord);
    const newLog: OperationLog = {
      id: generateId(),
      recordId: id,
      action: 'modify',
      operator: currentUser,
      reason,
      beforeData: oldRecord,
      afterData: updatedRecord,
      createdAt: formatDateTime(new Date()),
    };

    const newRecords = [...records];
    newRecords[recordIndex] = updatedRecord;
    const newLogs = [...operationLogs, newLog];

    saveRecords(newRecords);
    saveOperationLogs(newLogs);

    set({ records: newRecords, operationLogs: newLogs });
    return { success: true };
  },

  updateRecordStatus: (id, status, reason) => {
    const { records, operationLogs, currentUser } = get();
    const recordIndex = records.findIndex(r => r.id === id);

    if (recordIndex === -1) return;

    const oldRecord = records[recordIndex];
    const updatedRecord = { ...oldRecord, status, updatedAt: formatDateTime(new Date()) };

    const newLog: OperationLog = {
      id: generateId(),
      recordId: id,
      action: 'review',
      operator: currentUser,
      reason,
      beforeData: { status: oldRecord.status },
      afterData: { status },
      createdAt: formatDateTime(new Date()),
    };

    const newRecords = [...records];
    newRecords[recordIndex] = updatedRecord;
    const newLogs = [...operationLogs, newLog];

    saveRecords(newRecords);
    saveOperationLogs(newLogs);

    set({ records: newRecords, operationLogs: newLogs });
  },

  importRecords: (importData, operator) => {
    const { records, operationLogs } = get();
    const existingKeys = new Set(records.map(r => r.idempotentKey));
    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const newRecords: InventoryRecord[] = [...records];
    const newLogs: OperationLog[] = [...operationLogs];
    const now = formatDateTime(new Date());

    importData.forEach((data, index) => {
      const validation = validateRecord(data);
      if (!validation.valid) {
        failedCount++;
        errors.push(`第${index + 1}条: ${validation.errors.join(', ')}`);
        return;
      }

      const idempotentKey = data.idempotentKey || generateIdempotentKey(data.rawData || {});
      if (existingKeys.has(idempotentKey)) {
        failedCount++;
        errors.push(`第${index + 1}条: 幂等键 ${idempotentKey} 已存在，跳过`);
        return;
      }

      const newRecord: InventoryRecord = {
        ...data,
        id: generateId(),
        source: data.source || 'api_doc',
        status: data.status || 'pending',
        preOccupyQty: data.preOccupyQty || 0,
        releaseQty: data.releaseQty || 0,
        operator: data.operator || operator,
        idempotentKey,
        idempotentValid: data.idempotentValid ?? true,
        rawData: data.rawData || {},
        createdAt: now,
        updatedAt: now,
      } as InventoryRecord;

      const newLog: OperationLog = {
        id: generateId(),
        recordId: newRecord.id,
        action: 'import',
        operator,
        reason: '批量导入接口文档',
        afterData: { ...newRecord },
        createdAt: now,
      };

      newRecords.push(newRecord);
      newLogs.push(newLog);
      existingKeys.add(idempotentKey);
      successCount++;
    });

    saveRecords(newRecords);
    saveOperationLogs(newLogs);

    set({ records: newRecords, operationLogs: newLogs });
    return { success: successCount, failed: failedCount, errors };
  },

  changePermission: (recordId, beforePerm, afterPerm, reason) => {
    const { permissionChanges, operationLogs, currentUser, records } = get();
    const now = formatDateTime(new Date());

    const diffSnapshot = compareObjects(beforePerm, afterPerm);

    const newPermChange: PermissionChange = {
      id: generateId(),
      recordId,
      operator: currentUser,
      beforePermission: beforePerm,
      afterPermission: afterPerm,
      changeReason: reason,
      diffSnapshot,
      createdAt: now,
    };

    const newLog: OperationLog = {
      id: generateId(),
      recordId,
      action: 'permission_change',
      operator: currentUser,
      reason,
      beforeData: beforePerm,
      afterData: afterPerm,
      createdAt: now,
    };

    const newPermChanges = [...permissionChanges, newPermChange];
    const newLogs = [...operationLogs, newLog];

    const recordIndex = records.findIndex(r => r.id === recordId);
    if (recordIndex !== -1) {
      const newRecords = [...records];
      newRecords[recordIndex] = {
        ...newRecords[recordIndex],
        updatedAt: now,
      };
      saveRecords(newRecords);
      set({ records: newRecords });
    }

    savePermissionChanges(newPermChanges);
    saveOperationLogs(newLogs);

    set({ permissionChanges: newPermChanges, operationLogs: newLogs });
  },

  generateExportReport: () => {
    const { records, permissionChanges, filters } = get();
    const filtered = get().getFilteredRecords();

    const statistics = {
      total: filtered.length,
      pending: filtered.filter(r => r.status === 'pending').length,
      completed: filtered.filter(r => r.status === 'completed').length,
      error: filtered.filter(r => r.status === 'error').length,
      processing: filtered.filter(r => r.status === 'processing').length,
      idempotentInvalid: filtered.filter(r => !r.idempotentValid).length,
      permissionChanges: permissionChanges.filter(pc =>
        filtered.some(r => r.id === pc.recordId)
      ).length,
      completionRate: calculateCompletionRate(
        filtered.length,
        filtered.filter(r => r.status === 'completed').length
      ),
    };

    const abnormalRecords = filtered.filter(r =>
      r.status === 'error' || !r.idempotentValid
    );

    const relatedPermChanges = permissionChanges.filter(pc =>
      filtered.some(r => r.id === pc.recordId)
    );

    const suggestions = generateSuggestions(filtered, relatedPermChanges);

    const exportLog: OperationLog = {
      id: generateId(),
      recordId: 'export',
      action: 'export',
      operator: get().currentUser,
      reason: '导出迁移报告',
      createdAt: formatDateTime(new Date()),
    };

    const newLogs = [...get().operationLogs, exportLog];
    saveOperationLogs(newLogs);
    set({ operationLogs: newLogs });

    return {
      generatedAt: formatDateTime(new Date()),
      generatedBy: get().currentUser,
      filters,
      statistics,
      records: filtered,
      permissionChanges: relatedPermChanges,
      abnormalRecords,
      suggestions,
      reviewChecklist: {
        keyMetricsChecked: false,
        abnormalRecordsChecked: false,
        permissionChangesChecked: false,
      },
    };
  },

  exportReportJson: (report) => {
    const filename = `库存预占释放报告_${getTodayDateString()}.json`;
    exportToJson(report, filename);
  },

  exportReportExcel: (report) => {
    const filename = `库存预占释放报告_${getTodayDateString()}.xlsx`;
    exportToExcel(report.records, report.permissionChanges, filename);
  },

  setFilters: (filters) => set({ filters }),

  setSelectedRecord: (id) => set({ selectedRecordId: id }),

  setCurrentUser: (name) => set({ currentUser: name }),

  getRecordById: (id) => get().records.find(r => r.id === id),

  getLogsByRecordId: (recordId) => get().operationLogs
    .filter(l => l.recordId === recordId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

  getPermissionChangesByRecordId: (recordId) => get().permissionChanges
    .filter(p => p.recordId === recordId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),

  getIdempotentInvalidRecords: () => get().records.filter(r => !r.idempotentValid),

  getFilteredRecords: () => {
    const { records, filters } = get();
    let filtered = [...records];

    if (filters.status) {
      filtered = filtered.filter(r => r.status === filters.status);
    }
    if (filters.source) {
      filtered = filtered.filter(r => r.source === filters.source);
    }
    if (filters.keyword) {
      const kw = filters.keyword.toLowerCase();
      filtered = filtered.filter(r =>
        r.stockCode.toLowerCase().includes(kw) ||
        r.interfaceName.toLowerCase().includes(kw) ||
        r.operator.toLowerCase().includes(kw) ||
        r.idempotentKey.toLowerCase().includes(kw)
      );
    }
    if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
      const start = new Date(filters.dateRange[0]).getTime();
      const end = new Date(filters.dateRange[1]).getTime() + 24 * 60 * 60 * 1000;
      filtered = filtered.filter(r => {
        const t = new Date(r.createdAt).getTime();
        return t >= start && t < end;
      });
    }

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },
}));
