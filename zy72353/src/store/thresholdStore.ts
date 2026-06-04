import { create } from 'zustand';
import type {
  ThresholdData,
  HistoryRecord,
  WorkflowTask,
  HandoverReport,
  Device,
  ImportResult,
  WorkflowStep,
} from '../types';
import {
  mockThresholds,
  mockHistory,
  mockWorkflowTasks,
  mockReports,
  mockDevices,
} from '../data/mockData';

interface ThresholdState {
  thresholds: ThresholdData[];
  history: HistoryRecord[];
  workflowTasks: WorkflowTask[];
  reports: HandoverReport[];
  devices: Device[];
  currentRole: 'engineer' | 'coach';
  selectedThreshold: ThresholdData | null;

  setCurrentRole: (role: 'engineer' | 'coach') => void;
  setSelectedThreshold: (threshold: ThresholdData | null) => void;

  importThresholds: (newThresholds: Partial<ThresholdData>[]) => ImportResult;
  updateThreshold: (id: string, updates: Partial<ThresholdData>, reason: string) => void;
  checkUnitMix: (deviceId: string) => boolean;

  getThresholdHistory: (thresholdId: string) => HistoryRecord[];
  getDeviceById: (deviceId: string) => Device | undefined;
  getTasksByAssignee: (assignee: 'engineer' | 'coach') => WorkflowTask[];
  getReportByThresholdId: (thresholdId: string) => HandoverReport | undefined;
  advanceWorkflow: (taskId: string) => void;
  generateReport: (thresholdId: string, reportData: Partial<HandoverReport>) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

const getCurrentTime = () => new Date().toISOString();

export const useThresholdStore = create<ThresholdState>((set, get) => ({
  thresholds: mockThresholds,
  history: mockHistory,
  workflowTasks: mockWorkflowTasks,
  reports: mockReports,
  devices: mockDevices,
  currentRole: 'engineer',
  selectedThreshold: null,

  setCurrentRole: (role) => set({ currentRole: role }),
  setSelectedThreshold: (threshold) => set({ selectedThreshold: threshold }),

  importThresholds: (newThresholds) => {
    const { thresholds } = get();
    const result: ImportResult = {
      success: 0,
      duplicate: 0,
      error: 0,
      messages: [],
    };

    const imported: ThresholdData[] = [];
    const now = getCurrentTime();

    newThresholds.forEach((item, index) => {
      if (!item.name || !item.value || !item.deviceId) {
        result.error++;
        result.messages.push(`行 ${index + 1}: 缺少必要字段`);
        return;
      }

      const isDuplicate = thresholds.some(
        (t) =>
          t.name === item.name &&
          t.deviceId === item.deviceId &&
          Math.abs(t.value - (item.value || 0)) < 0.01
      );

      if (isDuplicate) {
        result.duplicate++;
        result.messages.push(`跳过重复数据: ${item.name} - ${item.value}`);
        return;
      }

      const hasUnitMix = get().checkUnitMix(item.deviceId!);

      imported.push({
        id: `th-${generateId()}`,
        name: item.name || '',
        value: item.value || 0,
        unit: item.unit || 'Celsius',
        deviceId: item.deviceId || '',
        remark: item.remark || '导入数据',
        status: 'pending',
        calculationModel: item.calculationModel,
        modelVersion: item.modelVersion,
        tradeOffReason: item.tradeOffReason,
        hasUnitMix,
        createdBy: get().currentRole === 'engineer' ? '何工' : '训练教练',
        createdAt: now,
        updatedAt: now,
      });

      result.success++;
    });

    set((state) => ({
      thresholds: [...state.thresholds, ...imported],
    }));

    imported.forEach((t) => {
      const task: WorkflowTask = {
        id: `task-${generateId()}`,
        thresholdId: t.id,
        step: 'engineer_review',
        status: 'pending',
        assignee: 'engineer',
        previousStep: 'import',
        nextStep: 'coach_review',
        createdAt: now,
      };
      set((state) => ({
        workflowTasks: [...state.workflowTasks, task],
      }));
    });

    return result;
  },

  updateThreshold: (id, updates, reason) => {
    const { thresholds, history, currentRole } = get();
    const now = getCurrentTime();
    const modifiedBy = currentRole === 'engineer' ? '何工' : '训练教练';

    const threshold = thresholds.find((t) => t.id === id);
    if (!threshold) return;

    const newHistoryRecords: HistoryRecord[] = [];

    Object.entries(updates).forEach(([key, value]) => {
      const oldValue = String(threshold[key as keyof ThresholdData] ?? '');
      const newValue = String(value ?? '');
      if (oldValue !== newValue) {
        newHistoryRecords.push({
          id: `h-${generateId()}`,
          thresholdId: id,
          fieldName: key,
          oldValue,
          newValue,
          modifiedBy,
          modifiedAt: now,
          changeReason: reason,
        });
      }
    });

    set((state) => ({
      thresholds: state.thresholds.map((t) =>
        t.id === id ? { ...t, ...updates, updatedAt: now } : t
      ),
      history: [...state.history, ...newHistoryRecords],
    }));
  },

  checkUnitMix: (deviceId) => {
    const { thresholds } = get();
    const deviceThresholds = thresholds.filter((t) => t.deviceId === deviceId);
    if (deviceThresholds.length === 0) return false;

    const units = new Set(deviceThresholds.map((t) => t.unit));
    return units.size > 1;
  },

  getThresholdHistory: (thresholdId) => {
    return get().history.filter((h) => h.thresholdId === thresholdId);
  },

  getDeviceById: (deviceId) => {
    return get().devices.find((d) => d.id === deviceId);
  },

  getTasksByAssignee: (assignee) => {
    return get().workflowTasks.filter((t) => t.assignee === assignee);
  },

  getReportByThresholdId: (thresholdId) => {
    return get().reports.find((r) => r.thresholdId === thresholdId);
  },

  advanceWorkflow: (taskId) => {
    const { workflowTasks, currentRole } = get();
    const task = workflowTasks.find((t) => t.id === taskId);
    if (!task) return;

    const stepOrder: WorkflowStep[] = ['import', 'engineer_review', 'coach_review', 'report'];
    const currentIndex = stepOrder.indexOf(task.step);

    if (currentIndex < stepOrder.length - 1) {
      const nextStep = stepOrder[currentIndex + 1];
      const nextAssignee = nextStep === 'coach_review' || nextStep === 'report' ? 'coach' : 'engineer';

      set((state) => ({
        workflowTasks: state.workflowTasks.map((t) =>
          t.id === taskId
            ? {
                ...t,
                step: nextStep,
                status: 'pending' as const,
                assignee: nextAssignee,
                previousStep: task.step,
                nextStep: currentIndex + 2 < stepOrder.length ? stepOrder[currentIndex + 2] : undefined,
                completedAt: getCurrentTime(),
              }
            : t
        ),
      }));

      const statusMap: Record<WorkflowStep, 'pending' | 'reviewing' | 'approved'> = {
        import: 'pending',
        engineer_review: 'reviewing',
        coach_review: 'approved',
        report: 'approved',
      };

      get().updateThreshold(
        task.thresholdId,
        { status: statusMap[nextStep] },
        `工作流推进至: ${nextStep}`
      );
    }
  },

  generateReport: (thresholdId, reportData) => {
    const { currentRole } = get();
    const now = getCurrentTime();

    const report: HandoverReport = {
      id: `report-${generateId()}`,
      thresholdId,
      content: reportData.content || '',
      retentionReason: reportData.retentionReason || '',
      missingMaterials: reportData.missingMaterials || [],
      nextAction: reportData.nextAction || '',
      assigneeRole: reportData.assigneeRole || 'engineer',
      createdBy: currentRole === 'engineer' ? '何工' : '训练教练',
      createdAt: now,
    };

    set((state) => ({
      reports: [...state.reports, report],
    }));
  },
}));
