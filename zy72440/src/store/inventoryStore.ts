import { create } from 'zustand';
import type { InventoryRecord, OperationLog, ProcessStep, StatisticsData, RecordStatus } from '@/types';
import { demoRecords } from '@/data/demoData';

interface InventoryState {
  records: InventoryRecord[];
  selectedRecordId: string | null;
  useDemoData: boolean;
  
  loadDemoData: () => void;
  selectRecord: (id: string | null) => void;
  getRecordById: (id: string) => InventoryRecord | undefined;
  getStatistics: () => StatisticsData;
  getPendingReviewRecords: () => InventoryRecord[];
  getSupplementaryRecords: () => InventoryRecord[];
  
  reviewJietlong: (recordId: string, jietlongContent: string) => void;
  markSupplementary: (recordId: string, note: string) => void;
  manualCorrect: (recordId: string, newQuantity: number) => void;
  rerunValidation: (recordId: string) => void;
  managerReview: (recordId: string, missingCity: string) => void;
  addOperationLog: (recordId: string, log: Omit<OperationLog, 'id' | 'timestamp'>) => void;
}

export const useInventoryStore = create<InventoryState>((set, get) => ({
  records: [],
  selectedRecordId: null,
  useDemoData: false,

  loadDemoData: () => {
    set({ records: [...demoRecords], useDemoData: true });
  },

  selectRecord: (id) => set({ selectedRecordId: id }),

  getRecordById: (id) => {
    return get().records.find(r => r.id === id);
  },

  getStatistics: () => {
    const records = get().records;
    return {
      total: records.length,
      normal: records.filter(r => r.status === 'normal').length,
      pendingReview: records.filter(r => r.status === 'pending_review').length,
      supplementary: records.filter(r => r.status === 'supplementary').length,
      completed: records.filter(r => r.status === 'completed').length,
    };
  },

  getPendingReviewRecords: () => {
    return get().records.filter(r => r.status === 'pending_review');
  },

  getSupplementaryRecords: () => {
    return get().records.filter(r => r.status === 'supplementary');
  },

  addOperationLog: (recordId, log) => {
    set(state => ({
      records: state.records.map(r => {
        if (r.id === recordId) {
          const newLog: OperationLog = {
            ...log,
            id: `log-${Date.now()}`,
            timestamp: new Date().toLocaleString('zh-CN', { 
              year: 'numeric', month: '2-digit', day: '2-digit',
              hour: '2-digit', minute: '2-digit', second: '2-digit'
            }).replace(/\//g, '-')
          };
          return {
            ...r,
            operationLogs: [...r.operationLogs, newLog],
            updatedAt: newLog.timestamp
          };
        }
        return r;
      })
    }));
  },

  reviewJietlong: (recordId, jietlongContent) => {
    set(state => ({
      records: state.records.map(r => {
        if (r.id === recordId) {
          const updated: InventoryRecord = {
            ...r,
            groupJietlong: jietlongContent,
            currentStep: 'update_verification',
            status: (r.status === 'pending_review' ? 'pending_review' : 'normal') as RecordStatus
          };
          return updated;
        }
        return r;
      })
    }));
    get().addOperationLog(recordId, {
      operator: '巡演统筹-阿梅',
      action: '补看接龙',
      description: `查看排练群接龙：${jietlongContent.substring(0, 50)}...`,
      step: 'review_jietlong'
    });
  },

  markSupplementary: (recordId, note) => {
    set(state => ({
      records: state.records.map(r => {
        if (r.id === recordId) {
          return {
            ...r,
            status: 'supplementary',
            hasSupplementary: true,
            supplementaryNote: note
          };
        }
        return r;
      })
    }));
    get().addOperationLog(recordId, {
      operator: '巡演统筹-阿梅',
      action: '标记补录返工',
      description: note,
      step: 'review_jietlong'
    });
  },

  manualCorrect: (recordId, newQuantity) => {
    set(state => ({
      records: state.records.map(r => {
        if (r.id === recordId) {
          return {
            ...r,
            quantity: newQuantity
          };
        }
        return r;
      })
    }));
    get().addOperationLog(recordId, {
      operator: '巡演统筹-阿梅',
      action: '人工修正',
      description: `数量修正为 ${newQuantity}`,
      step: 'review_jietlong'
    });
  },

  rerunValidation: (recordId) => {
    set(state => ({
      records: state.records.map(r => {
        if (r.id === recordId) {
          const newVerificationOrder = r.verificationOrder ? {
            ...r.verificationOrder,
            quantity: r.quantity,
            amount: r.quantity * 50,
            status: 'matched' as const,
            mismatchReason: undefined
          } : undefined;
          
          return {
            ...r,
            status: 'completed',
            currentStep: 'update_verification',
            verificationOrder: newVerificationOrder
          };
        }
        return r;
      })
    }));
    get().addOperationLog(recordId, {
      operator: '系统',
      action: '重跑校验',
      description: '重跑校验通过，已更新核销单',
      step: 'update_verification'
    });
  },

  managerReview: (recordId, missingCity) => {
    set(state => ({
      records: state.records.map(r => {
        if (r.id === recordId) {
          return {
            ...r,
            authorizedRegions: r.authorizedRegions.map(reg => 
              reg.isMissing && reg.city === missingCity 
                ? { ...reg, isMissing: false }
                : reg
            ),
            status: 'normal',
            currentStep: 'review_jietlong'
          };
        }
        return r;
      })
    }));
    get().addOperationLog(recordId, {
      operator: '店长',
      action: '复核补充地区',
      description: `已补充授权地区：${missingCity}`,
      step: 'import'
    });
  }
}));
