import { create } from 'zustand';
import type { WorkflowRecord, WorkflowStatus } from '../types';
import { logger } from '../utils/logger';

interface WorkflowState {
  records: WorkflowRecord[];
  addRecord: (
    collisionId: string,
    fromStatus: WorkflowStatus,
    toStatus: WorkflowStatus,
    handler: string,
    remark: string
  ) => void;
  getRecordsByCollision: (collisionId: string) => WorkflowRecord[];
  clearRecords: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  records: [],

  addRecord: (collisionId, fromStatus, toStatus, handler, remark) => {
    const record: WorkflowRecord = {
      id: `rec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      collisionId,
      fromStatus,
      toStatus,
      handler,
      remark,
      timestamp: new Date().toISOString(),
    };

    set((state) => ({
      records: [...state.records, record],
    }));

    logger.info('workflow', '添加工作流记录', {
      collisionId,
      fromStatus,
      toStatus,
      handler,
    });
  },

  getRecordsByCollision: (collisionId) => {
    return get()
      .records.filter((r) => r.collisionId === collisionId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  },

  clearRecords: () => {
    set({ records: [] });
    logger.info('workflow', '已清空工作流记录');
  },
}));
