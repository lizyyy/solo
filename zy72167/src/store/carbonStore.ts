import { create } from 'zustand';
import type { CarbonRecord, MergeGroup, AuditTrail, RecordStatus, SourceType } from '@/types';
import { loadFromStorage, debouncedSave, clearStorage } from '@/utils/storage';
import { getInitialState } from '@/data/mockData';
import { createMergeGroups } from '@/utils/mergeAlgorithm';
import { calculateDiffs } from '@/utils/exporter';
import type { SupplementDiff } from '@/types';

interface CarbonState {
  records: CarbonRecord[];
  mergeGroups: MergeGroup[];
  currentOperator: string;
  lastSaved: string | null;
  isLoading: boolean;
  
  init: () => void;
  addRecords: (partialRecords: Partial<CarbonRecord>[], sourceType: SourceType) => void;
  runMerge: () => void;
  updateRecordStatus: (recordId: string, status: RecordStatus, reason: string, remark?: string) => void;
  confirmGroup: (groupId: string) => void;
  rejectGroup: (groupId: string, reason: string) => void;
  splitGroup: (groupId: string) => void;
  addRemark: (recordId: string, remark: string) => void;
  supplementRecord: (recordId: string, updates: Partial<CarbonRecord>) => { diffs: SupplementDiff[]; newRecord: CarbonRecord };
  resetData: () => void;
  getRecordsByStatus: (status: RecordStatus) => CarbonRecord[];
  getGroupRecords: (groupId: string) => CarbonRecord[];
  getTotalCarbon: () => number;
  getStats: () => {
    total: number;
    confirmed: number;
    pending: number;
    needsReview: number;
    rejected: number;
    totalCarbon: number;
  };
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function createAuditTrail(
  recordId: string,
  actionType: AuditTrail['actionType'],
  actionReason: string,
  operator: string,
  beforeState: Partial<CarbonRecord> | null,
  afterState: Partial<CarbonRecord> | null,
  remark?: string
): AuditTrail {
  return {
    id: generateId('trail'),
    recordId,
    actionType,
    actionReason,
    operator,
    timestamp: new Date().toISOString(),
    beforeState,
    afterState,
    remark,
  };
}

export const useCarbonStore = create<CarbonState>((set, get) => ({
  records: [],
  mergeGroups: [],
  currentOperator: '周姐（街道工作人员）',
  lastSaved: null,
  isLoading: true,

  init: () => {
    const saved = loadFromStorage();
    if (saved) {
      set({
        records: saved.records,
        mergeGroups: saved.mergeGroups,
        currentOperator: saved.currentOperator,
        lastSaved: saved.lastSaved,
        isLoading: false,
      });
    } else {
      const initial = getInitialState();
      set({
        records: initial.records,
        mergeGroups: initial.mergeGroups,
        currentOperator: initial.currentOperator,
        lastSaved: initial.lastSaved,
        isLoading: false,
      });
    }
  },

  addRecords: (partialRecords, sourceType) => {
    const state = get();
    const now = new Date().toISOString();
    
    const newRecords: CarbonRecord[] = partialRecords.map(partial => {
      const id = generateId('rec');
      const record: CarbonRecord = {
        id,
        pointName: partial.pointName || '未命名点位',
        originalName: partial.originalName || partial.pointName || '未命名点位',
        sourceType: partial.sourceType || sourceType,
        address: partial.address || '',
        carbonAmount: partial.carbonAmount || 0,
        unit: partial.unit || 'kgCO2e',
        recordDate: partial.recordDate || now.split('T')[0],
        status: 'pending_review',
        mergeGroupId: null,
        auditTrail: [
          createAuditTrail(
            id,
            'import',
            `从${sourceType === 'street_form' ? '街道表格' : sourceType === 'inspection_photo' ? '现场照片' : '审批记录'}导入`,
            state.currentOperator,
            null,
            { pointName: partial.pointName, carbonAmount: partial.carbonAmount, address: partial.address }
          ),
        ],
        location: partial.location || { lat: 39.95, lng: 116.41, mapX: Math.random() * 400 + 100, mapY: Math.random() * 300 + 100 },
        dataQuality: partial.dataQuality || 'normal',
        remark: partial.remark || '',
        operator: state.currentOperator,
        createdAt: now,
        updatedAt: now,
        isOldCaliber: partial.isOldCaliber,
        oldCaliberNote: partial.oldCaliberNote,
      };
      return record;
    });

    const updatedRecords = [...state.records, ...newRecords];
    const { groups, updatedRecords: mergedRecords } = createMergeGroups(updatedRecords, state.currentOperator);
    
    const newState = {
      records: mergedRecords,
      mergeGroups: [...state.mergeGroups, ...groups],
      currentOperator: state.currentOperator,
      lastSaved: now,
    };
    
    set(newState);
    debouncedSave(newState);
  },

  runMerge: () => {
    const state = get();
    const { groups, updatedRecords } = createMergeGroups(state.records, state.currentOperator);
    const now = new Date().toISOString();
    
    const newState = {
      records: updatedRecords,
      mergeGroups: groups,
      currentOperator: state.currentOperator,
      lastSaved: now,
    };
    
    set(newState);
    debouncedSave(newState);
  },

  updateRecordStatus: (recordId, status, reason, remark) => {
    const state = get();
    const now = new Date().toISOString();
    const record = state.records.find(r => r.id === recordId);
    if (!record) return;

    const trail = createAuditTrail(
      recordId,
      status === 'review_confirmed' ? 'confirm' : status === 'rejected' ? 'reject' : 'remark',
      reason,
      state.currentOperator,
      { status: record.status },
      { status },
      remark
    );

    const updatedRecords = state.records.map(r =>
      r.id === recordId
        ? { ...r, status, auditTrail: [...r.auditTrail, trail], remark: remark || r.remark, updatedAt: now }
        : r
    );

    const newState = { records: updatedRecords, mergeGroups: state.mergeGroups, currentOperator: state.currentOperator, lastSaved: now };
    set(newState);
    debouncedSave(newState);
  },

  confirmGroup: (groupId) => {
    const state = get();
    const now = new Date().toISOString();
    const group = state.mergeGroups.find(g => g.id === groupId);
    if (!group) return;

    const updatedGroups = state.mergeGroups.map(g =>
      g.id === groupId ? { ...g, status: 'confirmed' as const } : g
    );

    const updatedRecords = state.records.map(r => {
      if (group.mergedRecordIds.includes(r.id)) {
        const trail = createAuditTrail(
          r.id,
          'confirm',
          `归并组"${group.canonicalName}"审核通过，匹配得分${group.confidenceScore}分`,
          state.currentOperator,
          { status: r.status },
          { status: 'review_confirmed' }
        );
        return { ...r, status: 'review_confirmed' as const, auditTrail: [...r.auditTrail, trail], updatedAt: now };
      }
      return r;
    });

    const newState = { records: updatedRecords, mergeGroups: updatedGroups, currentOperator: state.currentOperator, lastSaved: now };
    set(newState);
    debouncedSave(newState);
  },

  rejectGroup: (groupId, reason) => {
    const state = get();
    const now = new Date().toISOString();
    const group = state.mergeGroups.find(g => g.id === groupId);
    if (!group) return;

    const updatedGroups = state.mergeGroups.map(g =>
      g.id === groupId ? { ...g, status: 'rejected' as const } : g
    );

    const updatedRecords = state.records.map(r => {
      if (group.mergedRecordIds.includes(r.id)) {
        const trail = createAuditTrail(
          r.id,
          'reject',
          `归并被驳回：${reason}`,
          state.currentOperator,
          { status: r.status, mergeGroupId: groupId },
          { status: 'rejected', mergeGroupId: null }
        );
        return { ...r, status: 'rejected' as const, mergeGroupId: null, auditTrail: [...r.auditTrail, trail], updatedAt: now };
      }
      return r;
    });

    const newState = { records: updatedRecords, mergeGroups: updatedGroups, currentOperator: state.currentOperator, lastSaved: now };
    set(newState);
    debouncedSave(newState);
  },

  splitGroup: (groupId) => {
    const state = get();
    const now = new Date().toISOString();
    const group = state.mergeGroups.find(g => g.id === groupId);
    if (!group) return;

    const updatedGroups = state.mergeGroups.filter(g => g.id !== groupId);

    const updatedRecords = state.records.map(r => {
      if (group.mergedRecordIds.includes(r.id)) {
        const trail = createAuditTrail(
          r.id,
          'split',
          `从归并组"${group.canonicalName}"中拆分，作为独立点位处理`,
          state.currentOperator,
          { status: r.status, mergeGroupId: groupId },
          { status: 'split', mergeGroupId: null }
        );
        return { ...r, status: 'split' as const, mergeGroupId: null, auditTrail: [...r.auditTrail, trail], updatedAt: now };
      }
      return r;
    });

    const newState = { records: updatedRecords, mergeGroups: updatedGroups, currentOperator: state.currentOperator, lastSaved: now };
    set(newState);
    debouncedSave(newState);
  },

  addRemark: (recordId, remark) => {
    const state = get();
    const now = new Date().toISOString();
    const record = state.records.find(r => r.id === recordId);
    if (!record) return;

    const trail = createAuditTrail(
      recordId,
      'remark',
      '添加人工备注',
      state.currentOperator,
      { remark: record.remark },
      { remark },
      remark
    );

    const updatedRecords = state.records.map(r =>
      r.id === recordId
        ? { ...r, remark, auditTrail: [...r.auditTrail, trail], updatedAt: now }
        : r
    );

    const newState = { records: updatedRecords, mergeGroups: state.mergeGroups, currentOperator: state.currentOperator, lastSaved: now };
    set(newState);
    debouncedSave(newState);
  },

  supplementRecord: (recordId, updates) => {
    const state = get();
    const now = new Date().toISOString();
    const oldRecord = state.records.find(r => r.id === recordId);
    if (!oldRecord) return { diffs: [], newRecord: oldRecord as CarbonRecord };

    const diffs = calculateDiffs(oldRecord, updates) as SupplementDiff[];

    const trail = createAuditTrail(
      recordId,
      'supplement',
      '人工补录更新数据',
      state.currentOperator,
      { pointName: oldRecord.pointName, carbonAmount: oldRecord.carbonAmount, address: oldRecord.address },
      { pointName: updates.pointName, carbonAmount: updates.carbonAmount, address: updates.address }
    );

    const newRecord: CarbonRecord = {
      ...oldRecord,
      ...updates,
      auditTrail: [...oldRecord.auditTrail, trail],
      updatedAt: now,
    };

    const updatedRecords = state.records.map(r => r.id === recordId ? newRecord : r);

    const newState = { records: updatedRecords, mergeGroups: state.mergeGroups, currentOperator: state.currentOperator, lastSaved: now };
    set(newState);
    debouncedSave(newState);

    return { diffs, newRecord };
  },

  resetData: () => {
    clearStorage();
    const initial = getInitialState();
    set({
      records: initial.records,
      mergeGroups: initial.mergeGroups,
      currentOperator: initial.currentOperator,
      lastSaved: initial.lastSaved,
      isLoading: false,
    });
  },

  getRecordsByStatus: (status) => {
    return get().records.filter(r => r.status === status);
  },

  getGroupRecords: (groupId) => {
    return get().records.filter(r => r.mergeGroupId === groupId);
  },

  getTotalCarbon: () => {
    return get().records.reduce((sum, r) => sum + r.carbonAmount, 0);
  },

  getStats: () => {
    const records = get().records;
    return {
      total: records.length,
      confirmed: records.filter(r => r.status === 'review_confirmed').length,
      pending: records.filter(r => r.status === 'auto_merged' || r.status === 'pending_review').length,
      needsReview: records.filter(r => r.status === 'needs_confirmation').length,
      rejected: records.filter(r => r.status === 'rejected').length,
      totalCarbon: records.reduce((sum, r) => sum + r.carbonAmount, 0),
    };
  },
}));
