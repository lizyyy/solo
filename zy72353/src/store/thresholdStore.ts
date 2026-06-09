import { create } from 'zustand';
import type {
  ThresholdData,
  HistoryRecord,
  WorkflowTask,
  HandoverReport,
  Device,
  ImportResult,
  WorkflowStep,
  ImportBatch,
  ManualReviewRecord,
  ImportSource,
  ImportFileFormat,
  ThresholdStatus,
  ExportPackage,
  TemperatureUnit,
} from '../types';
import {
  mockThresholds,
  mockHistory,
  mockWorkflowTasks,
  mockReports,
  mockDevices,
  mockBatches,
  mockManualReviews,
} from '../data/mockData';

const STORAGE_KEY = 'threshold_system_state_v2';

interface ThresholdState {
  thresholds: ThresholdData[];
  history: HistoryRecord[];
  workflowTasks: WorkflowTask[];
  reports: HandoverReport[];
  devices: Device[];
  batches: ImportBatch[];
  manualReviews: ManualReviewRecord[];
  currentRole: 'engineer' | 'coach';
  selectedThreshold: ThresholdData | null;

  setCurrentRole: (role: 'engineer' | 'coach') => void;
  setSelectedThreshold: (threshold: ThresholdData | null) => void;

  importThresholds: (
    newThresholds: Partial<ThresholdData>[],
    opts: { source: ImportSource; format: ImportFileFormat; fileName?: string }
  ) => ImportResult;

  updateThreshold: (
    id: string,
    updates: Partial<ThresholdData>,
    reason: string,
    reviewOpts?: { createManualReview?: boolean; reviewType?: ManualReviewRecord['reviewType'] }
  ) => ManualReviewRecord | null;

  checkUnitMix: (deviceId: string, excludeId?: string) => boolean;

  getThresholdHistory: (thresholdId: string) => HistoryRecord[];
  getDeviceById: (deviceId: string) => Device | undefined;
  getTasksByAssignee: (assignee: 'engineer' | 'coach') => WorkflowTask[];
  getReportByThresholdId: (thresholdId: string) => HandoverReport | undefined;
  getBatchById: (batchId: string) => ImportBatch | undefined;
  getManualReviewByThresholdId: (thresholdId: string) => ManualReviewRecord | undefined;
  getThresholdsByBatchId: (batchId: string) => ThresholdData[];

  advanceWorkflow: (taskId: string, opts?: { reviewReason?: string }) => void;
  processManualReview: (
    reviewId: string,
    decision: 'confirmed' | 'rejected',
    opts?: { modifiedValue?: string; modifiedUnit?: TemperatureUnit; reason?: string }
  ) => void;

  generateReport: (
    thresholdId: string,
    reportData: Partial<HandoverReport>
  ) => HandoverReport | null;

  exportThreshold: (thresholdId: string) => ExportPackage;
  exportReport: (reportId: string) => ExportPackage;
  exportBatch: (batchId: string) => ExportPackage;
  traceByExportId: (exportId: string) => ExportPackage | null;

  verifyConsistency: (thresholdId: string) => {
    ok: boolean;
    issues: string[];
    snapshot: {
      threshold: ThresholdData;
      task?: WorkflowTask;
      report?: HandoverReport;
      batch?: ImportBatch;
      review?: ManualReviewRecord;
    };
  };

  resetState: () => void;
  persist: () => void;
  loadPersisted: () => void;
}

const generateId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;

const getCurrentTime = () => new Date().toISOString();

const hashData = (data: any): string => {
  const str = JSON.stringify(data);
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return `h${Math.abs(h).toString(16)}`;
};

const genBatchNo = () => {
  const d = new Date();
  const s = `${d.getFullYear()}${(d.getMonth() + 1).toString().padStart(2, '0')}${d
    .getDate()
    .toString()
    .padStart(2, '0')}`;
  return `BATCH-${s}-${Math.floor(Math.random() * 900 + 100)}`;
};

const DEFAULT_STATE = {
  thresholds: mockThresholds,
  history: mockHistory,
  workflowTasks: mockWorkflowTasks,
  reports: mockReports,
  devices: mockDevices,
  batches: mockBatches,
  manualReviews: mockManualReviews,
  currentRole: 'engineer' as const,
  selectedThreshold: null,
};

export const useThresholdStore = create<ThresholdState>((set, get) => ({
  ...DEFAULT_STATE,

  setCurrentRole: (role) => set({ currentRole: role }),
  setSelectedThreshold: (threshold) => set({ selectedThreshold: threshold }),

  importThresholds: (newThresholds, opts) => {
    const { thresholds: existing } = get();
    const now = getCurrentTime();
    const importedBy =
      get().currentRole === 'engineer' ? '何工' : opts.source === 'file' ? '何工' : '训练教练';

    const batchId = generateId('batch');
    const batchNo = genBatchNo();

    const result: ImportResult = {
      success: 0,
      duplicate: 0,
      error: 0,
      messages: [],
      batchId,
      importedIds: [],
    };

    const imported: ThresholdData[] = [];
    const newReviews: ManualReviewRecord[] = [];
    const newTasks: WorkflowTask[] = [];

    newThresholds.forEach((item, index) => {
      if (!item.name || item.value === undefined || !item.deviceId) {
        result.error++;
        result.messages.push(`行 ${index + 1}: 缺少必要字段 (name/value/deviceId)`);
        return;
      }

      const isDuplicate = existing.some(
        (t) =>
          t.name === item.name &&
          t.deviceId === item.deviceId &&
          Math.abs(t.value - (item.value || 0)) < 0.01
      );

      if (isDuplicate) {
        result.duplicate++;
        result.messages.push(
          `[跳过重复] ${item.name} @ ${item.deviceId} = ${item.value} ${item.unit || ''}`
        );
        return;
      }

      const hasUnitMix = get().checkUnitMix(item.deviceId!);

      const thId = generateId('th');
      const newThreshold: ThresholdData = {
        id: thId,
        name: item.name || '',
        value: item.value || 0,
        unit: (item.unit as TemperatureUnit) || 'Celsius',
        deviceId: item.deviceId || '',
        remark: item.remark || '导入数据',
        status: hasUnitMix ? 'needs_manual' : 'pending',
        calculationModel: item.calculationModel,
        modelVersion: item.modelVersion,
        tradeOffReason: item.tradeOffReason,
        hasUnitMix,
        createdBy: importedBy,
        createdAt: now,
        updatedAt: now,
        importBatchId: batchId,
        originalImportedValue: item.value,
        originalImportedUnit: item.unit as TemperatureUnit,
      };

      imported.push(newThreshold);
      result.success++;
      result.importedIds.push(thId);

      if (hasUnitMix) {
        const reviewId = generateId('review');
        newReviews.push({
          id: reviewId,
          thresholdId: thId,
          reviewType: 'unit_mix',
          originalValue: String(item.value),
          originalUnit: item.unit as TemperatureUnit,
          decision: 'pending',
          reason:
            '同一设备存在摄氏度/开尔文混用，按流程不自动归一，转训练教练复核并确认铭牌',
          reviewedBy: importedBy,
          createdAt: now,
        });
        newThreshold.manualReviewId = reviewId;
      }

      newTasks.push({
        id: generateId('task'),
        thresholdId: thId,
        step: 'engineer_review',
        status: 'pending',
        assignee: 'engineer',
        previousStep: 'import',
        nextStep: 'coach_review',
        createdAt: now,
      });
    });

    const batch: ImportBatch = {
      id: batchId,
      batchNo,
      source: opts.source,
      format: opts.format,
      fileName: opts.fileName,
      importedBy,
      importedAt: now,
      totalCount: newThresholds.length,
      successCount: result.success,
      duplicateCount: result.duplicate,
      errorCount: result.error,
      thresholdIds: result.importedIds,
      messages: result.messages,
    };

    set((state) => ({
      thresholds: [...state.thresholds, ...imported],
      workflowTasks: [...state.workflowTasks, ...newTasks],
      manualReviews: [...state.manualReviews, ...newReviews],
      batches: [batch, ...state.batches],
    }));

    result.messages.unshift(
      `批次 ${batchNo} 完成：共${newThresholds.length}条，成功${result.success}，重复${result.duplicate}，错误${result.error}`
    );

    return result;
  },

  updateThreshold: (id, updates, reason, reviewOpts) => {
    const { thresholds, history, currentRole, workflowTasks } = get();
    const now = getCurrentTime();
    const modifiedBy = currentRole === 'engineer' ? '何工' : '训练教练';

    const threshold = thresholds.find((t) => t.id === id);
    if (!threshold) return null;

    const task = workflowTasks.find((t) => t.thresholdId === id);
    const newHistoryRecords: HistoryRecord[] = [];
    let reviewRecord: ManualReviewRecord | null = null;

    Object.entries(updates).forEach(([key, value]) => {
      const oldValue = String(threshold[key as keyof ThresholdData] ?? '');
      const newValue = String(value ?? '');
      if (oldValue !== newValue) {
        newHistoryRecords.push({
          id: generateId('h'),
          thresholdId: id,
          fieldName: key,
          oldValue,
          newValue,
          modifiedBy,
          modifiedAt: now,
          changeReason: reason,
          consistencySnapshot: {
            thresholdStatus: (updates.status as ThresholdStatus) || threshold.status,
            workflowStep: task?.step,
            batchId: threshold.importBatchId,
          },
        });
      }
    });

    if (reviewOpts?.createManualReview && (reviewOpts.reviewType || Object.keys(updates).length)) {
      reviewRecord = {
        id: generateId('review'),
        thresholdId: id,
        reviewType: reviewOpts.reviewType || 'remark_change',
        originalValue: String(
          threshold[Object.keys(updates)[0] as keyof ThresholdData] ?? ''
        ),
        originalUnit: threshold.unit,
        modifiedValue: String(updates[Object.keys(updates)[0] as keyof ThresholdData] ?? ''),
        modifiedUnit: (updates.unit as TemperatureUnit) || threshold.unit,
        decision: 'pending',
        reason: reason || '备注或数值人工调整，需教练复核确认',
        reviewedBy: modifiedBy,
        createdAt: now,
      };

      set((state) => ({
        manualReviews: reviewRecord ? [...state.manualReviews, reviewRecord] : state.manualReviews,
      }));
    }

    const finalUpdates: Partial<ThresholdData> = { ...updates };
    if (reviewRecord) finalUpdates.manualReviewId = reviewRecord.id;

    set((state) => ({
      thresholds: state.thresholds.map((t) =>
        t.id === id ? { ...t, ...finalUpdates, updatedAt: now } : t
      ),
      history: [...state.history, ...newHistoryRecords],
    }));

    return reviewRecord;
  },

  checkUnitMix: (deviceId, excludeId) => {
    const { thresholds } = get();
    const deviceThresholds = thresholds.filter(
      (t) => t.deviceId === deviceId && t.id !== excludeId
    );
    if (deviceThresholds.length === 0) return false;
    const units = new Set(deviceThresholds.map((t) => t.unit));
    return units.size > 1;
  },

  getThresholdHistory: (thresholdId) => get().history.filter((h) => h.thresholdId === thresholdId),
  getDeviceById: (deviceId) => get().devices.find((d) => d.id === deviceId),
  getTasksByAssignee: (assignee) => get().workflowTasks.filter((t) => t.assignee === assignee),
  getReportByThresholdId: (thresholdId) => get().reports.find((r) => r.thresholdId === thresholdId),
  getBatchById: (batchId) => get().batches.find((b) => b.id === batchId),
  getManualReviewByThresholdId: (thresholdId) =>
    get().manualReviews.find((r) => r.thresholdId === thresholdId),
  getThresholdsByBatchId: (batchId) => get().thresholds.filter((t) => t.importBatchId === batchId),

  advanceWorkflow: (taskId, opts) => {
    const { workflowTasks, currentRole } = get();
    const task = workflowTasks.find((t) => t.id === taskId);
    if (!task) return;

    const stepOrder: WorkflowStep[] = ['import', 'engineer_review', 'coach_review', 'report'];
    const currentIndex = stepOrder.indexOf(task.step);

    if (currentIndex < stepOrder.length - 1) {
      const nextStep = stepOrder[currentIndex + 1];
      const nextAssignee: 'engineer' | 'coach' =
        nextStep === 'coach_review' || nextStep === 'report' ? 'coach' : 'engineer';
      const now = getCurrentTime();

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
                completedAt: now,
                consistencyCheckedAt: now,
              }
            : t
        ),
      }));

      const statusMap: Record<WorkflowStep, ThresholdStatus> = {
        import: 'pending',
        engineer_review: 'reviewing',
        coach_review: 'approved',
        report: 'approved',
      };

      get().updateThreshold(
        task.thresholdId,
        { status: statusMap[nextStep] },
        opts?.reviewReason || `工作流推进至: ${nextStep}，由${currentRole === 'engineer' ? '何工' : '训练教练'}处理`
      );
    }
  },

  processManualReview: (reviewId, decision, opts) => {
    const { manualReviews, currentRole } = get();
    const review = manualReviews.find((r) => r.id === reviewId);
    if (!review) return;
    const now = getCurrentTime();
    const reviewer = currentRole === 'engineer' ? '何工' : '训练教练';

    const updates: Partial<ManualReviewRecord> = {
      decision,
      reviewedBy: reviewer,
      reviewedAt: now,
    };
    if (opts?.modifiedValue) updates.modifiedValue = opts.modifiedValue;
    if (opts?.modifiedUnit) updates.modifiedUnit = opts.modifiedUnit;
    if (opts?.reason) updates.reason = opts.reason;

    set((state) => ({
      manualReviews: state.manualReviews.map((r) =>
        r.id === reviewId ? { ...r, ...updates } : r
      ),
    }));

    if (decision === 'confirmed') {
      const thresholdUpdates: Partial<ThresholdData> = { hasUnitMix: false };
      if (opts?.modifiedValue !== undefined && opts.modifiedValue !== null) {
        thresholdUpdates.value = Number(opts.modifiedValue);
      }
      if (opts?.modifiedUnit) {
        thresholdUpdates.unit = opts.modifiedUnit;
      }
      get().updateThreshold(
        review.thresholdId,
        thresholdUpdates,
        `人工复核确认：${opts?.reason || '教练确认'}`
      );
    }
  },

  generateReport: (thresholdId, reportData) => {
    const { currentRole, thresholds } = get();
    const threshold = thresholds.find((t) => t.id === thresholdId);
    if (!threshold) return null;
    const now = getCurrentTime();
    const exportTraceId = generateId('exp');

    const report: HandoverReport = {
      id: generateId('report'),
      thresholdId,
      content: reportData.content || '',
      retentionReason: reportData.retentionReason || '',
      missingMaterials: reportData.missingMaterials || [],
      nextAction: reportData.nextAction || '',
      assigneeRole: reportData.assigneeRole || 'engineer',
      createdBy: currentRole === 'engineer' ? '何工' : '训练教练',
      createdAt: now,
      exportTraceId,
      snapshot: {
        thresholdValue: threshold.value,
        thresholdUnit: threshold.unit,
        thresholdStatus: threshold.status,
        thresholdRemark: threshold.remark,
      },
    };

    set((state) => ({
      reports: [...state.reports, report],
      thresholds: state.thresholds.map((t) =>
        t.id === thresholdId ? { ...t, exportTraceId, updatedAt: now } : t
      ),
    }));

    return report;
  },

  exportThreshold: (thresholdId) => {
    const { thresholds, history, workflowTasks, reports, batches, manualReviews, currentRole } =
      get();
    const th = thresholds.find((t) => t.id === thresholdId);
    if (!th) throw new Error('Threshold not found');
    const now = getCurrentTime();
    const exportId = th.exportTraceId || generateId('exp');

    const pkg: ExportPackage = {
      exportId,
      exportedAt: now,
      exportedBy: currentRole === 'engineer' ? '何工' : '训练教练',
      type: 'threshold',
      referenceIds: [
        thresholdId,
        th.importBatchId,
        th.manualReviewId,
        ...history.filter((h) => h.thresholdId === thresholdId).map((h) => h.id),
        ...workflowTasks.filter((t) => t.thresholdId === thresholdId).map((t) => t.id),
        ...reports.filter((r) => r.thresholdId === thresholdId).map((r) => r.id),
      ].filter(Boolean) as string[],
      data: {
        threshold: th,
        batch: batches.find((b) => b.id === th.importBatchId),
        manualReview: manualReviews.find((r) => r.id === th.manualReviewId),
        history: history.filter((h) => h.thresholdId === thresholdId),
        workflow: workflowTasks.filter((t) => t.thresholdId === thresholdId),
        report: reports.find((r) => r.thresholdId === thresholdId),
      },
      hash: '',
    };
    pkg.hash = hashData(pkg.data);

    set((state) => ({
      thresholds: state.thresholds.map((t) =>
        t.id === thresholdId ? { ...t, exportTraceId: exportId } : t
      ),
    }));

    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `threshold_${th.id}_${exportId}.json`;
    a.click();
    URL.revokeObjectURL(url);

    return pkg;
  },

  exportReport: (reportId) => {
    const { reports, thresholds, currentRole } = get();
    const report = reports.find((r) => r.id === reportId);
    if (!report) throw new Error('Report not found');
    const now = getCurrentTime();
    const th = thresholds.find((t) => t.id === report.thresholdId);
    const exportId = report.exportTraceId || generateId('exp');

    const pkg: ExportPackage = {
      exportId,
      exportedAt: now,
      exportedBy: currentRole === 'engineer' ? '何工' : '训练教练',
      type: 'report',
      referenceIds: [reportId, report.thresholdId].filter(Boolean) as string[],
      data: { report, thresholdSnapshot: report.snapshot, threshold: th },
      hash: '',
    };
    pkg.hash = hashData(pkg.data);

    const lines: string[] = [];
    lines.push('====== 冷凝管结霜阈值交接报告 ======');
    lines.push(`导出追踪号: ${exportId}`);
    lines.push(`导出时间: ${now}`);
    lines.push(`导出人: ${pkg.exportedBy}`);
    lines.push('');
    lines.push(`阈值记录ID: ${report.thresholdId}`);
    if (report.snapshot) {
      lines.push(
        `阈值快照: ${report.snapshot.thresholdValue} ${
          report.snapshot.thresholdUnit === 'Celsius' ? '℃' : 'K'
        }  [状态:${report.snapshot.thresholdStatus}]`
      );
      lines.push(`备注快照: ${report.snapshot.thresholdRemark}`);
    }
    lines.push('');
    lines.push(`【内容】${report.content}`);
    lines.push(`【留存原因】${report.retentionReason}`);
    lines.push(`【缺少材料】${report.missingMaterials.length ? report.missingMaterials.join('；') : '无'}`);
    lines.push(`【下一步行动】${report.nextAction}`);
    lines.push(`【对接人】${report.assigneeRole === 'engineer' ? '设备工程师 何工' : '训练教练'}`);
    lines.push('');
    lines.push(`数据校验哈希: ${pkg.hash}`);
    lines.push('（导入/导出系统时可反查此 ID 到同一条原始记录）');

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${report.id}_${exportId}.txt`;
    a.click();
    URL.revokeObjectURL(url);

    return pkg;
  },

  exportBatch: (batchId) => {
    const { batches, thresholds, history, currentRole } = get();
    const batch = batches.find((b) => b.id === batchId);
    if (!batch) throw new Error('Batch not found');
    const now = getCurrentTime();
    const exportId = generateId('exp');

    const batchThresholds = thresholds.filter((t) => t.importBatchId === batchId);
    const batchHistory = history.filter((h) =>
      batchThresholds.some((t) => t.id === h.thresholdId)
    );

    const pkg: ExportPackage = {
      exportId,
      exportedAt: now,
      exportedBy: currentRole === 'engineer' ? '何工' : '训练教练',
      type: 'batch',
      referenceIds: [batchId, ...batchThresholds.map((t) => t.id)],
      data: { batch, thresholds: batchThresholds, history: batchHistory },
      hash: '',
    };
    pkg.hash = hashData(pkg.data);

    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `batch_${batch.batchNo}_${exportId}.json`;
    a.click();
    URL.revokeObjectURL(url);

    return pkg;
  },

  traceByExportId: (exportId) => {
    const { thresholds, reports } = get();
    const byTh = thresholds.find((t) => t.exportTraceId === exportId);
    const byRep = reports.find((r) => r.exportTraceId === exportId);
    if (!byTh && !byRep) return null;

    if (byRep) {
      return {
        exportId,
        exportedAt: byRep.createdAt,
        exportedBy: byRep.createdBy,
        type: 'report' as const,
        referenceIds: [byRep.id, byRep.thresholdId],
        data: { report: byRep, snapshot: byRep.snapshot },
        hash: hashData({ report: byRep }),
      };
    }
    return null;
  },

  verifyConsistency: (thresholdId) => {
    const state = get();
    const threshold = state.thresholds.find((t) => t.id === thresholdId);
    const issues: string[] = [];
    if (!threshold) return { ok: false, issues: ['阈值不存在'], snapshot: {} as any };

    const task = state.workflowTasks
      .filter((t) => t.thresholdId === thresholdId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    const report = state.reports.find((r) => r.thresholdId === thresholdId);
    const batch = state.batches.find((b) => b.id === threshold.importBatchId);
    const review = state.manualReviews.find((r) => r.id === threshold.manualReviewId);

    const statusMap: Record<WorkflowStep, ThresholdStatus[]> = {
      import: ['pending', 'needs_manual'],
      engineer_review: ['reviewing', 'needs_manual'],
      coach_review: ['approved', 'reviewing'],
      report: ['approved'],
    };
    if (task && !statusMap[task.step].includes(threshold.status)) {
      issues.push(
        `状态不一致：工作流当前步骤=${task.step}，但阈值状态=${threshold.status}`
      );
    }

    if (report && report.snapshot) {
      if (report.snapshot.thresholdValue !== threshold.value) {
        issues.push(
          `报告快照不一致：报告阈值=${report.snapshot.thresholdValue}，当前=${threshold.value}`
        );
      }
      if (report.snapshot.thresholdStatus !== threshold.status) {
        issues.push(
          `报告状态不一致：报告状态=${report.snapshot.thresholdStatus}，当前=${threshold.status}`
        );
      }
    }

    if (threshold.hasUnitMix && (!review || review.decision === 'pending')) {
      issues.push(`该记录存在单位混用，且尚未有人工复核结论`);
    }

    if (
      threshold.status === 'approved' &&
      review &&
      review.decision === 'pending' &&
      threshold.hasUnitMix
    ) {
      issues.push(`数据冲突：单位混用未复核但状态已批准`);
    }

    return {
      ok: issues.length === 0,
      issues,
      snapshot: { threshold, task, report, batch, review },
    };
  },

  resetState: () => set({ ...DEFAULT_STATE, selectedThreshold: null }),

  persist: () => {
    try {
      const s = get();
      const toSave = {
        thresholds: s.thresholds,
        history: s.history,
        workflowTasks: s.workflowTasks,
        reports: s.reports,
        batches: s.batches,
        manualReviews: s.manualReviews,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn('persist failed', e);
    }
  },

  loadPersisted: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      set((state) => ({
        ...state,
        thresholds: data.thresholds || state.thresholds,
        history: data.history || state.history,
        workflowTasks: data.workflowTasks || state.workflowTasks,
        reports: data.reports || state.reports,
        batches: data.batches || state.batches,
        manualReviews: data.manualReviews || state.manualReviews,
      }));
    } catch (e) {
      console.warn('loadPersisted failed', e);
    }
  },
}));
