import { getStore } from '../database/memoryStore';
import { WorkflowRecord, WorkflowStep } from '../types';
import { generateId, getCurrentTime } from '../utils/common';

export const workflowDao = {
  create: (data: Omit<WorkflowRecord, 'id' | 'createdAt' | 'updatedAt'>): WorkflowRecord => {
    const store = getStore();
    const id = generateId();
    const now = getCurrentTime();
    const record: WorkflowRecord = { ...data, id, createdAt: now, updatedAt: now };
    store.workflowRecords.push(record);
    return record;
  },

  findById: (id: string): WorkflowRecord | null => {
    const store = getStore();
    return store.workflowRecords.find(w => w.id === id) || null;
  },

  findByShelterId: (shelterId: string): WorkflowRecord[] => {
    const store = getStore();
    return store.workflowRecords
      .filter(w => w.shelterId === shelterId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  findLatestByShelterId: (shelterId: string): WorkflowRecord | null => {
    const records = workflowDao.findByShelterId(shelterId);
    const active = records.find(w => w.stepStatus !== 'completed');
    return active || records[0] || null;
  },

  findByStep: (step: WorkflowStep): WorkflowRecord[] => {
    const store = getStore();
    return store.workflowRecords
      .filter(w => w.currentStep === step)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  findAll: (): WorkflowRecord[] => {
    const store = getStore();
    return [...store.workflowRecords].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  updateStep: (id: string, stepData: Partial<Pick<WorkflowRecord, 'currentStep' | 'stepStatus' | 'nextStep' | 'previousStep' | 'operator' | 'remark' | 'redLineMapId' | 'inspectorReportId'>>): void => {
    const store = getStore();
    const idx = store.workflowRecords.findIndex(w => w.id === id);
    if (idx !== -1) {
      store.workflowRecords[idx] = {
        ...store.workflowRecords[idx],
        ...stepData,
        updatedAt: getCurrentTime()
      };
    }
  },

  suspend: (id: string, operator: string, remark: string): void => {
    workflowDao.updateStep(id, { stepStatus: 'suspended', operator, remark });
  }
};
