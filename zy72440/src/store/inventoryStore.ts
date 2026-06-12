import { create } from 'zustand';
import type { InventoryRecord, OperationLog, ProcessStep, StatisticsData, RecordStatus, VerificationOrder } from '@/types';
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

function makeVerificationOrder(recordId: string, quantity: number, index: number): VerificationOrder {
  const date = new Date();
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return {
    id: `ver-${Date.now()}`,
    orderNo: `HX-${dateStr}-${String(index).padStart(3, '0')}`,
    recordId,
    quantity,
    amount: quantity * 50,
    status: 'matched',
    createdAt: new Date().toLocaleString('zh-CN', {
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    }).replace(/\//g, '-')
  };
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
    const record = get().records.find(r => r.id === recordId);
    if (!record) return;

    const newOrder = makeVerificationOrder(recordId, record.quantity, get().records.indexOf(record) + 1);

    set(state => ({
      records: state.records.map(r => {
        if (r.id === recordId) {
          const updated: InventoryRecord = {
            ...r,
            groupJietlong: jietlongContent,
            currentStep: 'update_verification',
            status: 'completed',
            verificationOrder: newOrder
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
    get().addOperationLog(recordId, {
      operator: '系统',
      action: '生成核销单',
      description: `课时核销单 ${newOrder.orderNo} 已生成，数量${record.quantity}件，金额${newOrder.amount}元`,
      step: 'update_verification'
    });
  },

  markSupplementary: (recordId, note) => {
    set(state => ({
      records: state.records.map(r => {
        if (r.id === recordId) {
          const updatedVerification = r.verificationOrder ? {
            ...r.verificationOrder,
            status: 'mismatch' as const,
            mismatchReason: note
          } : undefined;
          return {
            ...r,
            status: 'supplementary',
            currentStep: 'review_jietlong',
            hasSupplementary: true,
            supplementaryNote: note,
            verificationOrder: updatedVerification
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
          const newVerificationOrder: VerificationOrder = r.verificationOrder ? {
            ...r.verificationOrder,
            quantity: r.quantity,
            amount: r.quantity * 50,
            status: 'matched',
            mismatchReason: undefined
          } : makeVerificationOrder(recordId, r.quantity, state.records.indexOf(r) + 1);
          
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
      description: `重跑校验通过，核销单已更新，数量${get().records.find(r => r.id === recordId)?.quantity}件`,
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
            status: 'normal' as RecordStatus,
            currentStep: 'review_jietlong' as ProcessStep
          };
        }
        return r;
      })
    }));
    get().addOperationLog(recordId, {
      operator: '店长',
      action: '复核补充地区',
      description: `已补充授权地区：${missingCity}，记录转为正常，等待巡演统筹补看排练群接龙`,
      step: 'import'
    });
  }
}));
