import { create } from 'zustand';
import { ReviewRecord, RecordStatus, ConflictResolution } from '../types';
import { mockRecords } from '../data/mockRecords';

interface ReviewState {
  records: ReviewRecord[];
  selectedRecord: ReviewRecord | null;
  filterType: 'all' | 'normal' | 'duplicate' | 'supplement';
  searchKeyword: string;
  isLoading: boolean;
  
  setFilterType: (type: 'all' | 'normal' | 'duplicate' | 'supplement') => void;
  setSearchKeyword: (keyword: string) => void;
  selectRecord: (id: string) => void;
  clearSelectedRecord: () => void;
  updateRecordStatus: (id: string, status: RecordStatus, operator: string, comment?: string) => void;
  resolveConflict: (recordId: string, conflictId: string, resolution: ConflictResolution, operator: string) => void;
  advanceStep: (recordId: string) => void;
  getFilteredRecords: () => ReviewRecord[];
}

export const useReviewStore = create<ReviewState>((set, get) => ({
  records: mockRecords,
  selectedRecord: null,
  filterType: 'all',
  searchKeyword: '',
  isLoading: false,

  setFilterType: (type) => set({ filterType: type }),
  
  setSearchKeyword: (keyword) => set({ searchKeyword: keyword }),
  
  selectRecord: (id) => {
    const record = get().records.find(r => r.id === id);
    set({ selectedRecord: record || null });
  },
  
  clearSelectedRecord: () => set({ selectedRecord: null }),
  
  updateRecordStatus: (id, status, operator, comment) => {
    const now = new Date().toLocaleString('zh-CN', { 
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).replace(/\//g, '-');
    
    set((state) => ({
      records: state.records.map(record => {
        if (record.id === id) {
          const newLog = {
            id: `LOG-${Date.now()}`,
            operator,
            action: status === 'confirmed' ? '确认通过' : '驳回',
            detail: comment || (status === 'confirmed' ? '标注负责人复核通过' : '标注负责人驳回'),
            timestamp: now,
          };
          
          const newEvidence = status === 'confirmed' ? {
            id: `EVD-${Date.now()}`,
            type: 'review' as const,
            title: '标注负责人确认',
            content: comment || '证据链复核通过，确认处理结果',
            source: '标注系统',
            timestamp: now,
            operator,
          } : {
            id: `EVD-${Date.now()}`,
            type: 'review' as const,
            title: '标注负责人驳回',
            content: comment || '证据不足或存在疑问，驳回处理',
            source: '标注系统',
            timestamp: now,
            operator,
          };
          
          return {
            ...record,
            status,
            updatedAt: now,
            currentStep: 'step3',
            operationLogs: [...record.operationLogs, newLog],
            evidences: [...record.evidences, newEvidence],
          };
        }
        return record;
      }),
      selectedRecord: state.selectedRecord?.id === id 
        ? get().records.find(r => r.id === id) || null
        : state.selectedRecord,
    }));
  },
  
  resolveConflict: (recordId, conflictId, resolution, operator) => {
    const now = new Date().toLocaleString('zh-CN', { 
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false
    }).replace(/\//g, '-');
    
    const resolutionLabels: Record<string, string> = {
      confirm_kb: '确认知识库口径',
      confirm_work_order: '确认工单口径',
      reject_both: '驳回两方，重新核实',
    };
    
    set((state) => ({
      records: state.records.map(record => {
        if (record.id === recordId && record.conflicts) {
          const newLog = {
            id: `LOG-${Date.now()}`,
            operator,
            action: '处理冲突',
            detail: `${resolutionLabels[resolution || '']}`,
            timestamp: now,
          };
          
          const newEvidence = {
            id: `EVD-${Date.now()}`,
            type: 'review' as const,
            title: '冲突处理结果',
            content: `标注负责人选择：${resolutionLabels[resolution || '']}`,
            source: '标注系统',
            timestamp: now,
            operator,
          };
          
          return {
            ...record,
            updatedAt: now,
            conflicts: record.conflicts.map(c => 
              c.id === conflictId
                ? { ...c, resolution, resolvedBy: operator, resolvedAt: now }
                : c
            ),
            operationLogs: [...record.operationLogs, newLog],
            evidences: [...record.evidences, newEvidence],
          };
        }
        return record;
      }),
      selectedRecord: state.selectedRecord?.id === recordId 
        ? get().records.find(r => r.id === recordId) || null
        : state.selectedRecord,
    }));
  },
  
  advanceStep: (recordId) => {
    set((state) => ({
      records: state.records.map(record => {
        if (record.id === recordId) {
          const stepOrder: Array<'step1' | 'step2' | 'step3'> = ['step1', 'step2', 'step3'];
          const currentIndex = stepOrder.indexOf(record.currentStep);
          const nextStep = stepOrder[Math.min(currentIndex + 1, 2)];
          return { ...record, currentStep: nextStep };
        }
        return record;
      }),
      selectedRecord: state.selectedRecord?.id === recordId 
        ? get().records.find(r => r.id === recordId) || null
        : state.selectedRecord,
    }));
  },
  
  getFilteredRecords: () => {
    const { records, filterType, searchKeyword } = get();
    let filtered = records;
    
    if (filterType !== 'all') {
      filtered = filtered.filter(r => r.type === filterType);
    }
    
    if (searchKeyword.trim()) {
      const keyword = searchKeyword.toLowerCase();
      filtered = filtered.filter(r => 
        r.id.toLowerCase().includes(keyword) ||
        r.userId.toLowerCase().includes(keyword) ||
        r.userFeedback.toLowerCase().includes(keyword)
      );
    }
    
    return filtered;
  },
}));
