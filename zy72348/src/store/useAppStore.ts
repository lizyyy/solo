import { create } from 'zustand';
import type {
  ImportBatch,
  Annotation,
  SampleRecord,
  ConflictItem,
  ConflictEvidence,
  WorkflowStep,
  AuditLog,
  SelfCheckResult,
  MedianAlert,
  ConflictStatus,
} from '@/types';
import { createAuditLog } from '@/utils/factories';

interface AppState {
  batches: ImportBatch[];
  annotations: Annotation[];
  samples: SampleRecord[];
  conflicts: ConflictItem[];
  evidences: ConflictEvidence[];
  workflowSteps: WorkflowStep[];
  auditLogs: AuditLog[];
  selfChecks: SelfCheckResult[];
  alerts: MedianAlert[];
  currentBatchId: string | null;

  addBatch: (batch: ImportBatch) => void;
  addAnnotations: (anns: Annotation[]) => void;
  addSamples: (smps: SampleRecord[]) => void;
  addConflicts: (items: ConflictItem[], evds: ConflictEvidence[]) => void;
  addSelfChecks: (results: SelfCheckResult[]) => void;
  addAlerts: (alerts: MedianAlert[]) => void;
  resolveConflict: (conflictId: string, status: ConflictStatus, resolution: string, operator: string) => void;
  advanceWorkflow: (batchId: string) => void;
  blockWorkflow: (batchId: string, reason: string) => void;
  setCurrentBatch: (batchId: string | null) => void;
  updateBatchStatus: (batchId: string, status: ImportBatch['status']) => void;
  logAction: (batchId: string, action: string, actor: string, detail: string) => void;
  initWorkflow: (batchId: string, operator: string) => void;
  getBatchById: (batchId: string) => ImportBatch | undefined;
  getAnnotationsByBatch: (batchId: string) => Annotation[];
  getSamplesByBatch: (batchId: string) => SampleRecord[];
  getConflictsByBatch: (batchId: string) => ConflictItem[];
  getEvidencesByConflict: (conflictId: string) => ConflictEvidence[];
  getWorkflowByBatch: (batchId: string) => WorkflowStep[];
  getChecksByBatch: (batchId: string) => SelfCheckResult[];
  getAlertsByBatch: (batchId: string) => MedianAlert[];
  getLogsByBatch: (batchId: string) => AuditLog[];
  getPendingConflictsCount: () => number;
}

export const useAppStore = create<AppState>((set, get) => ({
  batches: [],
  annotations: [],
  samples: [],
  conflicts: [],
  evidences: [],
  workflowSteps: [],
  auditLogs: [],
  selfChecks: [],
  alerts: [],
  currentBatchId: null,

  addBatch: (batch) => set((s) => ({ batches: [...s.batches, batch] })),

  addAnnotations: (anns) => set((s) => ({ annotations: [...s.annotations, ...anns] })),

  addSamples: (smps) => set((s) => ({ samples: [...s.samples, ...smps] })),

  addConflicts: (items, evds) => set((s) => ({
    conflicts: [...s.conflicts, ...items],
    evidences: [...s.evidences, ...evds],
  })),

  addSelfChecks: (results) => set((s) => ({ selfChecks: [...s.selfChecks, ...results] })),

  addAlerts: (alerts) => set((s) => ({ alerts: [...s.alerts, ...alerts] })),

  resolveConflict: (conflictId, status, resolution, operator) =>
    set((s) => ({
      conflicts: s.conflicts.map((c) =>
        c.id === conflictId
          ? { ...c, status, resolution, resolvedBy: operator, resolvedAt: new Date().toISOString() }
          : c,
      ),
    })),

  advanceWorkflow: (batchId) =>
    set((s) => {
      const steps = s.workflowSteps.filter((st) => st.batchId === batchId);
      const currentStep = steps.find((st) => st.status === 'in_progress' || st.status === 'pending');
      if (!currentStep) return s;
      const updatedSteps = s.workflowSteps.map((st) => {
        if (st.batchId !== batchId) return st;
        if (st.id === currentStep.id) {
          return { ...st, status: 'completed' as const, completedAt: new Date().toISOString() };
        }
        if (st.stepIndex === (currentStep.stepIndex + 1) as 1 | 2 | 3) {
          return { ...st, status: 'in_progress' as const, startedAt: new Date().toISOString() };
        }
        return st;
      });
      return { workflowSteps: updatedSteps };
    }),

  blockWorkflow: (batchId, reason) =>
    set((s) => ({
      workflowSteps: s.workflowSteps.map((st) =>
        st.batchId === batchId && st.status === 'in_progress'
          ? { ...st, status: 'blocked' as const, snapshot: reason }
          : st,
      ),
    })),

  setCurrentBatch: (batchId) => set({ currentBatchId: batchId }),

  updateBatchStatus: (batchId, status) =>
    set((s) => ({
      batches: s.batches.map((b) => (b.id === batchId ? { ...b, status } : b)),
    })),

  logAction: (batchId, action, actor, detail) =>
    set((s) => ({ auditLogs: [...s.auditLogs, createAuditLog(batchId, action, actor, detail)] })),

  initWorkflow: (batchId, operator) =>
    set((s) => {
      const existing = s.workflowSteps.filter((st) => st.batchId === batchId);
      if (existing.length > 0) return s;
      const steps: WorkflowStep[] = [
        { id: `step_${batchId}_1`, batchId, stepIndex: 1, stepName: '老师批注首次导入', status: 'in_progress', startedAt: new Date().toISOString(), completedAt: '', operator, snapshot: '' },
        { id: `step_${batchId}_2`, batchId, stepIndex: 2, stepName: '数据分析师补看抽样名单', status: 'pending', startedAt: '', completedAt: '', operator, snapshot: '' },
        { id: `step_${batchId}_3`, batchId, stepIndex: 3, stepName: '课堂演示结果更新', status: 'pending', startedAt: '', completedAt: '', operator, snapshot: '' },
      ];
      return { workflowSteps: [...s.workflowSteps, ...steps] };
    }),

  getBatchById: (batchId) => get().batches.find((b) => b.id === batchId),
  getAnnotationsByBatch: (batchId) => get().annotations.filter((a) => a.batchId === batchId),
  getSamplesByBatch: (batchId) => get().samples.filter((s) => s.batchId === batchId),
  getConflictsByBatch: (batchId) => {
    const annIds = new Set(get().annotations.filter((a) => a.batchId === batchId).map((a) => a.id));
    const smpIds = new Set(get().samples.filter((s) => s.batchId === batchId).map((s) => s.id));
    return get().conflicts.filter((c) => annIds.has(c.annotationId) || smpIds.has(c.sampleId));
  },
  getEvidencesByConflict: (conflictId) => get().evidences.filter((e) => e.conflictId === conflictId),
  getWorkflowByBatch: (batchId) => get().workflowSteps.filter((st) => st.batchId === batchId).sort((a, b) => a.stepIndex - b.stepIndex),
  getChecksByBatch: (batchId) => get().selfChecks.filter((c) => c.batchId === batchId),
  getAlertsByBatch: (batchId) => get().alerts.filter((a) => a.batchId === batchId),
  getLogsByBatch: (batchId) => get().auditLogs.filter((l) => l.batchId === batchId),
  getPendingConflictsCount: () => get().conflicts.filter((c) => c.status === 'pending' || c.status === 'needs_review').length,
}));
