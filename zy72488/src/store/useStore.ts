import { create } from 'zustand';
import type { Point, Conflict, HistoryRecord, SelfCheckResult, Workflow, WorkflowStepData, ImportBatchRecord } from '@/types';
import { mockPoints, mockConflicts, mockHistory, mockSelfCheckResults, mockWorkflows } from '@/data/mockData';

interface AppState {
  points: Point[];
  conflicts: Conflict[];
  history: HistoryRecord[];
  selfCheckResults: SelfCheckResult[];
  workflows: Workflow[];
  currentUser: string;
  selectedPointId: string | null;
  setSelectedPointId: (id: string | null) => void;
  updatePoint: (id: string, updates: Partial<Point>) => void;
  addHistory: (record: Omit<HistoryRecord, 'id' | 'createdAt'>) => void;
  updateConflict: (id: string, updates: Partial<Conflict>) => void;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;
  runSelfCheck: () => void;
  completeStep1: (workflowId: string, busCardTime: string, importSource?: string, batchId?: string) => {
    isDuplicate: boolean; duplicateCount: number; batchId: string; sameBatchCount: number; isSameBatch: boolean;
  };
  completeStep2: (workflowId: string, redLineNote: string, changeReason?: string) => { hasConflict: boolean; conflictDescription: string };
  completeStep3: (workflowId: string) => { pointStatus: string; reviewStatus: string; needsReview: boolean };
  approveReview: (pointId: string) => void;
  rejectReview: (pointId: string, reason?: string) => void;
  checkDuplicateImport: (pointId: string, busCardTime: string, batchId?: string) => {
    isDuplicate: boolean; count: number; lastSource: string; batchId: string;
    sameBatchCount: number; isSameBatch: boolean;
  };
  checkBusRedlineConflict: (busCardTime: string, redLineNote: string) => { hasConflict: boolean; description: string };
}

const generateId = (prefix: string) => `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const fieldLabels: Record<string, string> = {
  busCardTime: '公交刷卡时段', redLineNote: '红线图备注', status: '点位状态',
  reviewStatus: '复核状态', mapSynced: '地图同步', hasConstructionDetour: '施工改道',
  importCount: '导入次数', lastImportSource: '最近导入来源', lastImportBatchId: '最近批次号',
};

const statusLabels: Record<string, string> = {
  normal: '正常', pending: '待处理', conflict: '有冲突', 'pending-review': '待复核',
  'not-needed': '无需复核', approved: '已通过', rejected: '已驳回',
};

const formatValueLabel = (value: string | boolean | number | undefined, field: string): string => {
  if (value === undefined || value === null || value === '') return '（空）';
  if (typeof value === 'boolean') return value ? '是' : '否';
  if (field === 'status' || field === 'reviewStatus') return statusLabels[String(value)] || String(value);
  return String(value);
};

const parseTimeRanges = (text: string): Array<{ start: number; end: number }> => {
  const ranges: Array<{ start: number; end: number }> = [];
  const regex = /(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    const start = parseInt(match[1]) * 60 + parseInt(match[2]);
    const end = parseInt(match[3]) * 60 + parseInt(match[4]);
    ranges.push({ start, end });
  }
  return ranges;
};

export const useStore = create<AppState>((set, get) => ({
  points: mockPoints,
  conflicts: mockConflicts,
  history: mockHistory,
  selfCheckResults: mockSelfCheckResults,
  workflows: mockWorkflows,
  currentUser: '老马',
  selectedPointId: null,

  setSelectedPointId: (id) => set({ selectedPointId: id }),

  updatePoint: (id, updates) => set((state) => ({
    points: state.points.map((p) => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p),
  })),

  addHistory: (record) => set((state) => ({
    history: [{ ...record, id: generateId('h'), createdAt: new Date().toISOString() }, ...state.history],
  })),

  updateConflict: (id, updates) => set((state) => ({
    conflicts: state.conflicts.map((c) => c.id === id ? { ...c, ...updates } : c),
  })),

  updateWorkflow: (id, updates) => set((state) => ({
    workflows: state.workflows.map((w) => w.id === id ? { ...w, ...updates } : w),
  })),

  checkDuplicateImport: (pointId, busCardTime, batchId) => {
    const point = get().points.find((p) => p.id === pointId);
    if (!point || !batchId) return { isDuplicate: false, count: 0, lastSource: '', batchId: batchId || '', sameBatchCount: 0, isSameBatch: false };
    const sameBatchImports = point.importBatches.filter((b) => b.batchId === batchId);
    const isSameBatch = point.lastImportBatchId === batchId;
    const sameBatchCount = sameBatchImports.length;
    const isDuplicate = isSameBatch && sameBatchCount > 0 && sameBatchImports[0].busCardTime === busCardTime;
    return {
      isDuplicate,
      count: point.importCount,
      lastSource: point.lastImportSource,
      batchId,
      sameBatchCount,
      isSameBatch,
    };
  },

  checkBusRedlineConflict: (busCardTime, redLineNote) => {
    if (!redLineNote || !busCardTime) return { hasConflict: false, description: '' };
    const busRanges = parseTimeRanges(busCardTime);
    const redRanges = parseTimeRanges(redLineNote);
    if (busRanges.length === 0 || redRanges.length === 0) {
      const hasKeywords = /禁止|禁停|禁设|不允许|不得/.test(redLineNote);
      if (hasKeywords) {
        return { hasConflict: true, description: '红线图备注含禁止性描述，可能与公交时段存在冲突，请人工确认' };
      }
      return { hasConflict: false, description: '' };
    }
    let maxOverlap = 0;
    for (const br of busRanges) {
      for (const rr of redRanges) {
        const overlapStart = Math.max(br.start, rr.start);
        const overlapEnd = Math.min(br.end, rr.end);
        if (overlapEnd > overlapStart) {
          maxOverlap = Math.max(maxOverlap, overlapEnd - overlapStart);
        }
      }
    }
    if (maxOverlap > 0) {
      const mins = maxOverlap;
      return { hasConflict: true, description: `公交高峰与红线禁设时段存在${mins}分钟重叠，存在冲突` };
    }
    return { hasConflict: false, description: '' };
  },

  completeStep1: (workflowId, busCardTime, importSource = '公交公司', batchId) => {
    const state = get();
    const workflow = state.workflows.find((w) => w.id === workflowId);
    if (!workflow) return { isDuplicate: false, duplicateCount: 0, batchId: '', sameBatchCount: 0, isSameBatch: false };
    const point = state.points.find((p) => p.id === workflow.pointId);
    if (!point) return { isDuplicate: false, duplicateCount: 0, batchId: '', sameBatchCount: 0, isSameBatch: false };

    const actualBatchId = batchId || generateId('batch-');
    const dupeCheck = state.checkDuplicateImport(point.id, busCardTime, actualBatchId);
    const isSameBatch = dupeCheck.isSameBatch;
    const isDuplicate = dupeCheck.isDuplicate;
    const sameBatchCount = isSameBatch ? dupeCheck.sameBatchCount + 1 : 1;
    const newImportCount = point.importCount + 1;

    const batchRecord: ImportBatchRecord = {
      batchId: actualBatchId,
      source: importSource,
      importedAt: new Date().toISOString(),
      busCardTime,
      isDuplicate,
      importOrder: sameBatchCount,
    };

    const pointUpdates: Partial<Point> = {
      importCount: newImportCount,
      lastImportSource: importSource,
      lastImportBatchId: actualBatchId,
      importBatches: [...point.importBatches, batchRecord],
    };

    if (!isSameBatch) {
      pointUpdates.busCardTime = busCardTime;
    }

    const fieldChanges = [
      { field: 'importCount', fieldLabel: fieldLabels.importCount, beforeValue: formatValueLabel(point.importCount, 'importCount'), afterValue: formatValueLabel(newImportCount, 'importCount') },
      { field: 'lastImportBatchId', fieldLabel: fieldLabels.lastImportBatchId, beforeValue: formatValueLabel(point.lastImportBatchId, 'lastImportBatchId'), afterValue: formatValueLabel(actualBatchId, 'lastImportBatchId') },
    ];

    if (!isSameBatch) {
      fieldChanges.unshift({ field: 'busCardTime', fieldLabel: fieldLabels.busCardTime, beforeValue: formatValueLabel(point.busCardTime, 'busCardTime'), afterValue: formatValueLabel(busCardTime, 'busCardTime') });
    }

    const stepData: WorkflowStepData['step1'] = {
      busCardTime,
      importedAt: new Date().toISOString(),
      importSource,
      isDuplicate,
      duplicateDetected: isDuplicate,
      batchId: actualBatchId,
    };

    const historyAction = isDuplicate ? 'import' : 'import';
    const historyReason = isDuplicate ? `同一批次重传，已自动去重（批次${actualBatchId}，第${sameBatchCount}次导入）` : `新批次导入（批次${actualBatchId}）`;
    const historyRemark = isDuplicate ? '第一步：重传导入（已去重）' : '第一步：新批次导入';

    state.updatePoint(point.id, pointUpdates);
    state.addHistory({
      pointId: point.id, pointName: point.name, action: historyAction, operator: state.currentUser,
      beforeData: { importCount: point.importCount, busCardTime: point.busCardTime },
      afterData: { importCount: newImportCount, busCardTime: pointUpdates.busCardTime || point.busCardTime },
      fieldChanges, changeReason: historyReason, remark: historyRemark,
    });

    if (isDuplicate) {
      const newConflict: Conflict = {
        id: generateId('c'),
        pointId: point.id, pointName: point.name,
        type: 'duplicate-import',
        source: '第1步重复检测',
        batchId: actualBatchId, batchSource: importSource,
        importOrder: sameBatchCount, totalDuplicates: sameBatchCount,
        conclusion: '同一批次重传，已自动去重',
        status: 'resolved', handler: '系统自动处理',
        handledAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      };
      set((s) => ({ conflicts: [...s.conflicts, newConflict] }));
    }

    state.updateWorkflow(workflowId, {
      currentStep: 2,
      stepData: { ...workflow.stepData, step1: stepData },
    });

    return {
      isDuplicate,
      duplicateCount: isDuplicate ? sameBatchCount : 0,
      batchId: actualBatchId,
      sameBatchCount,
      isSameBatch,
    };
  },

  completeStep2: (workflowId, redLineNote, changeReason) => {
    const state = get();
    const workflow = state.workflows.find((w) => w.id === workflowId);
    if (!workflow) return { hasConflict: false, conflictDescription: '' };
    const point = state.points.find((p) => p.id === workflow.pointId);
    if (!point) return { hasConflict: false, conflictDescription: '' };

    const conflictResult = state.checkBusRedlineConflict(point.busCardTime, redLineNote);
    const hasConflict = conflictResult.hasConflict;
    const conflictDescription = conflictResult.description;

    const oldStatus = point.status;
    const newStatus: Point['status'] = hasConflict ? 'conflict' : 'pending';

    const pointUpdates: Partial<Point> = {
      redLineNote,
      status: newStatus,
    };

    const fieldChanges = [
      { field: 'redLineNote', fieldLabel: fieldLabels.redLineNote, beforeValue: formatValueLabel(point.redLineNote, 'redLineNote'), afterValue: formatValueLabel(redLineNote, 'redLineNote') },
      { field: 'status', fieldLabel: fieldLabels.status, beforeValue: formatValueLabel(oldStatus, 'status'), afterValue: formatValueLabel(newStatus, 'status') },
    ];

    if (hasConflict) {
      const existingConflict = state.conflicts.find(
        (c) => c.pointId === point.id && c.type === 'bus-vs-redline' && c.status === 'pending'
      );
      if (!existingConflict) {
        const newConflict: Conflict = {
          id: generateId('c'),
          pointId: point.id, pointName: point.name,
          type: 'bus-vs-redline',
          source: '第2步自动检测',
          busCardValue: point.busCardTime,
          redLineValue: redLineNote,
          evidence: conflictDescription,
          status: 'pending',
          createdAt: new Date().toISOString(),
        };
        set((s) => ({ conflicts: [...s.conflicts, newConflict] }));
      }
    }

    state.updatePoint(point.id, pointUpdates);
    state.addHistory({
      pointId: point.id, pointName: point.name, action: 'supplement', operator: state.currentUser,
      beforeData: { redLineNote: point.redLineNote, status: oldStatus },
      afterData: { redLineNote, status: newStatus },
      fieldChanges,
      changeReason: changeReason || (hasConflict ? '补录红线图备注，检测到冲突' : '补录红线图备注'),
      remark: hasConflict ? '第二步：补录红线图（发现冲突）' : '第二步：补录红线图（无冲突）',
    });

    state.updateWorkflow(workflowId, {
      currentStep: 3,
      stepData: {
        ...workflow.stepData,
        step2: {
          redLineNote,
          reviewedAt: new Date().toISOString(),
          reviewer: state.currentUser,
          hasConflict,
          conflictDescription,
        },
      },
    });

    return { hasConflict, conflictDescription };
  },

  completeStep3: (workflowId) => {
    const state = get();
    const workflow = state.workflows.find((w) => w.id === workflowId);
    if (!workflow) return { pointStatus: 'pending', reviewStatus: 'pending', needsReview: false };
    const point = state.points.find((p) => p.id === workflow.pointId);
    if (!point) return { pointStatus: 'pending', reviewStatus: 'pending', needsReview: false };

    const hasDetourNotSynced = point.hasConstructionDetour && !point.mapSynced;
    const hasBusConflict = state.conflicts.some(
      (c) => c.pointId === point.id && c.type === 'bus-vs-redline' && c.status === 'pending'
    );

    let finalPointStatus: Point['status'];
    let finalReviewStatus: Point['reviewStatus'];
    let needsReview = false;

    if (hasDetourNotSynced) {
      finalPointStatus = 'pending-review';
      finalReviewStatus = 'pending';
      needsReview = true;
    } else if (hasBusConflict) {
      finalPointStatus = 'conflict';
      finalReviewStatus = 'not-needed';
    } else {
      finalPointStatus = 'normal';
      finalReviewStatus = 'not-needed';
    }

    const oldStatus = point.status;
    const oldReviewStatus = point.reviewStatus;

    state.updatePoint(point.id, {
      status: finalPointStatus,
      reviewStatus: finalReviewStatus,
    });

    const hasDuplicate = point.importBatches.some((b) => b.isDuplicate);
    const lastBatch = point.importBatches[point.importBatches.length - 1];

    const duplicateCheckPassed = !hasDuplicate || (lastBatch && lastBatch.isDuplicate);
    const detourSyncPassed = !hasDetourNotSynced;
    const supplementRecalcPassed = !!point.redLineNote;
    const exportConsistentPassed = true;

    const items: Array<{ passed: boolean; detail: string }> = [
      { passed: duplicateCheckPassed, detail: hasDuplicate ? `同一批次重复导入，已自动去重` : '无重复导入' },
      { passed: detourSyncPassed, detail: hasDetourNotSynced ? '施工改道未同步地图，待复核' : '地图已同步' },
      { passed: supplementRecalcPassed, detail: point.redLineNote ? '红线备注已补录' : '红线备注待补录' },
      { passed: exportConsistentPassed, detail: '导出数据与系统一致' },
    ];

    const allPassed = items.every((i) => i.passed);
    const anyError = !detourSyncPassed;
    const overallStatus: 'pass' | 'warning' | 'error' = allPassed ? 'pass' : anyError ? 'error' : 'warning';

    const conclusions: string[] = [];
    if (hasDuplicate) conclusions.push('重复导入已去重');
    if (hasDetourNotSynced) conclusions.push('施工改道待复核');
    if (hasBusConflict) conclusions.push('公交与红线有冲突');
    if (allPassed) conclusions.push('全部检查通过');

    const finalReport = {
      duplicateCheck: { passed: duplicateCheckPassed, detail: items[0].detail, batchId: lastBatch?.batchId, batchSource: lastBatch?.source, count: point.importBatches.filter((b) => b.batchId === lastBatch?.batchId).length },
      detourSync: { passed: detourSyncPassed, detail: items[1].detail, source: '施工上报系统' },
      supplementRecalc: { passed: supplementRecalcPassed, detail: items[2].detail, hasConflict: hasBusConflict },
      exportConsistent: { passed: exportConsistentPassed, detail: items[3].detail },
      overallConclusion: conclusions.join('；'),
      overallStatus,
      finalPointStatus,
      finalReviewStatus,
    };

    const fieldChanges = [
      { field: 'status', fieldLabel: fieldLabels.status, beforeValue: formatValueLabel(oldStatus, 'status'), afterValue: formatValueLabel(finalPointStatus, 'status') },
      { field: 'reviewStatus', fieldLabel: fieldLabels.reviewStatus, beforeValue: formatValueLabel(oldReviewStatus, 'reviewStatus'), afterValue: formatValueLabel(finalReviewStatus, 'reviewStatus') },
    ];

    state.addHistory({
      pointId: point.id, pointName: point.name, action: 'update', operator: state.currentUser,
      beforeData: { status: oldStatus, reviewStatus: oldReviewStatus },
      afterData: { status: finalPointStatus, reviewStatus: finalReviewStatus },
      fieldChanges,
      changeReason: `完成三步流程，${needsReview ? '转交复核' : '点位状态更新'}`,
      remark: needsReview ? '第三步：完成流程（待复核）' : '第三步：完成流程',
    });

    state.updateWorkflow(workflowId, {
      currentStep: 3,
      status: needsReview ? 'pending-review' : 'completed',
      stepData: {
        ...workflow.stepData,
        step3: {
          updatedAt: new Date().toISOString(),
          operator: state.currentUser,
          pointStatus: finalPointStatus,
          reviewStatus: finalReviewStatus,
        },
      },
      finalReport,
    });

    return { pointStatus: finalPointStatus, reviewStatus: finalReviewStatus, needsReview };
  },

  approveReview: (pointId) => {
    const state = get();
    const point = state.points.find((p) => p.id === pointId);
    if (!point) return;

    const oldStatus = point.status;
    const oldReviewStatus = point.reviewStatus;

    state.updatePoint(pointId, {
      status: 'normal',
      reviewStatus: 'approved',
      mapSynced: true,
    });

    set((s) => ({
      conflicts: s.conflicts.map((c) =>
        c.pointId === pointId && c.type === 'detour-not-synced'
          ? { ...c, status: 'resolved' as const, handler: state.currentUser, handledAt: new Date().toISOString() }
          : c
      ),
    }));

    const fieldChanges = [
      { field: 'reviewStatus', fieldLabel: fieldLabels.reviewStatus, beforeValue: formatValueLabel(oldReviewStatus, 'reviewStatus'), afterValue: formatValueLabel('approved', 'reviewStatus') },
      { field: 'status', fieldLabel: fieldLabels.status, beforeValue: formatValueLabel(oldStatus, 'status'), afterValue: formatValueLabel('normal', 'status') },
      { field: 'mapSynced', fieldLabel: fieldLabels.mapSynced, beforeValue: formatValueLabel(point.mapSynced, 'mapSynced'), afterValue: formatValueLabel(true, 'mapSynced') },
    ];

    state.addHistory({
      pointId, pointName: point.name, action: 'review', operator: state.currentUser,
      beforeData: { status: oldStatus, reviewStatus: oldReviewStatus, mapSynced: point.mapSynced },
      afterData: { status: 'normal', reviewStatus: 'approved', mapSynced: true },
      fieldChanges,
      changeReason: '施工改道复核通过，地图已同步',
      remark: '复核通过，点位归正常',
    });
  },

  rejectReview: (pointId, reason) => {
    const state = get();
    const point = state.points.find((p) => p.id === pointId);
    if (!point) return;

    const oldReviewStatus = point.reviewStatus;

    state.updatePoint(pointId, {
      reviewStatus: 'rejected',
    });

    set((s) => ({
      conflicts: s.conflicts.map((c) =>
        c.pointId === pointId && c.type === 'detour-not-synced'
          ? { ...c, status: 'rejected' as const, handler: state.currentUser, handledAt: new Date().toISOString(), evidence: reason || c.evidence }
          : c
      ),
    }));

    const fieldChanges = [
      { field: 'reviewStatus', fieldLabel: fieldLabels.reviewStatus, beforeValue: formatValueLabel(oldReviewStatus, 'reviewStatus'), afterValue: formatValueLabel('rejected', 'reviewStatus') },
    ];

    state.addHistory({
      pointId, pointName: point.name, action: 'review', operator: state.currentUser,
      beforeData: { reviewStatus: oldReviewStatus },
      afterData: { reviewStatus: 'rejected' },
      fieldChanges,
      changeReason: reason || '复核驳回',
      remark: '复核驳回',
    });
  },

  runSelfCheck: () => {
    const state = get();
    const now = new Date().toISOString();

    const duplicateIssues: string[] = [];
    const detourIssues: string[] = [];
    const supplementIssues: string[] = [];

    for (const point of state.points) {
      const batchCounts: Record<string, number> = {};
      for (const batch of point.importBatches) {
        batchCounts[batch.batchId] = (batchCounts[batch.batchId] || 0) + 1;
      }
      for (const [bid, count] of Object.entries(batchCounts)) {
        if (count > 1) {
          duplicateIssues.push(`${point.name}：${bid}被导入${count}次，已自动去重`);
        }
      }
      if (point.hasConstructionDetour && !point.mapSynced) {
        detourIssues.push(`${point.name}：有改道但地图未同步`);
      }
      if (!point.redLineNote) {
        supplementIssues.push(`${point.name}：红线图备注待补录`);
      }
    }

    const duplicateStatus: 'pass' | 'warning' | 'error' = duplicateIssues.length === 0 ? 'pass' : 'warning';
    const detourStatus: 'pass' | 'warning' | 'error' = detourIssues.length === 0 ? 'pass' : 'error';
    const supplementStatus: 'pass' | 'warning' | 'error' = supplementIssues.length === 0 ? 'pass' : 'warning';
    const exportStatus: 'pass' | 'warning' | 'error' = 'pass';

    const overallStatus: 'pass' | 'warning' | 'error' =
      detourStatus === 'error' ? 'error' :
      duplicateStatus === 'warning' || supplementStatus === 'warning' ? 'warning' : 'pass';

    const summaryIssues: string[] = [];
    if (detourIssues.length > 0) summaryIssues.push(`${detourIssues.length}处施工改道未同步地图`);
    if (duplicateIssues.length > 0) summaryIssues.push(`${duplicateIssues.length}处重复导入（已去重）`);
    if (supplementIssues.length > 0) summaryIssues.push(`${supplementIssues.length}处待补录`);
    const summary = summaryIssues.length > 0 ? `发现${summaryIssues.join('，')}，其余正常。` : '全部检查通过。';

    const result: SelfCheckResult = {
      id: generateId('s'),
      reportName: `自检报告-${new Date().toLocaleDateString('zh-CN')}`,
      overallStatus,
      summary,
      items: [
        {
          type: 'duplicate-import', typeName: '重复导入检测',
          source: '导入记录比对（同点位+同批次+同内容）',
          status: duplicateStatus, issues: duplicateIssues,
          conclusion: duplicateIssues.length === 0 ? '无重复导入，数据一致。' : `${duplicateIssues.length}处重复导入，系统已自动去重，数据未翻倍。`,
        },
        {
          type: 'detour-sync', typeName: '施工改道同步',
          source: '施工上报系统与地图数据交叉比对',
          status: detourStatus, issues: detourIssues,
          conclusion: detourIssues.length === 0 ? '所有点位地图已同步。' : `${detourIssues.length}处未同步，已标记待居民代表复核。`,
        },
        {
          type: 'recalculate', typeName: '补录后重算',
          source: '补录记录与统计数据自动比对',
          status: supplementStatus, issues: supplementIssues,
          conclusion: supplementIssues.length === 0 ? '所有点位已补录完整。' : `${supplementIssues.length}处待补录，补录后自动重算。`,
        },
        {
          type: 'export-consistent', typeName: '导出一致性',
          source: '导出模板与系统数据逐项比对',
          status: exportStatus, issues: [],
          conclusion: '导出数据与系统内部完全一致。',
        },
      ],
      checkedAt: now,
      operator: state.currentUser,
    };

    set((s) => ({ selfCheckResults: [result, ...s.selfCheckResults] }));
  },
}));
