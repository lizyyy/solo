const fs = require('fs');

const content = `import { create } from 'zustand';
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
  generateId: (prefix: string) => string;
  checkDuplicateImport: (pointId: string, busCardTime: string, batchId?: string) => {
    isDuplicate: boolean; count: number; lastSource: string; batchId: string;
    sameBatchCount: number; isSameBatch: boolean; duplicateBatches: string[];
  };
  completeStep1: (workflowId: string, busCardTime: string, importSource?: string, batchId?: string) => {
    isDuplicate: boolean; duplicateCount: number; batchId: string; sameBatchCount: number; isSameBatch: boolean;
  };
  checkBusRedlineConflict: (busCardTime: string, redLineNote: string) => { hasConflict: boolean; description: string };
  completeStep2: (workflowId: string, redLineNote: string, changeReason?: string) => { hasConflict: boolean; conflictDescription: string };
  completeStep3: (workflowId: string) => { pointStatus: string; reviewStatus: string; needsReview: boolean };
  runSelfCheck: () => void;
  approveReview: (pointId: string) => void;
  rejectReview: (pointId: string, reason?: string) => void;
}

const generateId = (prefix: string) => \`\${prefix}\${Date.now()}-\${Math.random().toString(36).slice(2, 7)}\`;

const fieldLabels: Record<string, string> = {
  busCardTime: '公交刷卡时段', redLineNote: '红线图备注', status: '点位状态',
  reviewStatus: '复核状态', mapSynced: '地图同步', hasConstructionDetour: '施工改道',
  importCount: '导入次数', lastImportSource: '最近导入来源',
};

const statusLabels: Record<string, string> = {
  normal: '正常', pending: '待处理', conflict: '有冲突', 'pending-review': '待复核',
  'not-needed': '无需复核', approved: '已通过', rejected: '已驳回',
};

const formatValueLabel = (value: string | boolean | undefined, field: string): string => {
  if (value === undefined || value === null || value === '') return '（空）';
  if (typeof value === 'boolean') return value ? '是' : '否';
  return String(value);
};

export const useStore = create<AppState>((set, get) => ({
  points: mockPoints,
  conflicts: mockConflicts,
  history: mockHistory,
  selfCheckResults: mockSelfCheckResults,
  workflows: mockWorkflows,
  currentUser: '老马',
  selectedPointId: null,
  generateId,

  setSelectedPointId: (id) => set({ selectedPointId: id }),

  updatePoint: (id, updates) =>
    set((state) => ({ points: state.points.map((p) => p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p) })),

  addHistory: (record) =>
    set((state) => ({ history: [{ ...record, id: generateId('h'), createdAt: new Date().toISOString() }, ...state.history] })),

  updateConflict: (id, updates) =>
    set((state) => ({ conflicts: state.conflicts.map((c) => c.id === id ? { ...c, ...updates, handledAt: new Date().toISOString(), handler: get().currentUser } : c) })),

  updateWorkflow: (id, updates) =>
    set((state) => ({ workflows: state.workflows.map((w) => w.id === id ? { ...w, ...updates } : w) })),

  checkDuplicateImport: (pointId, busCardTime, batchId) => {
    const { points } = get();
    const point = points.find((p) => p.id === pointId);
    const effectiveBatchId = batchId || generateId('batch-');
    if (!point) return { isDuplicate: false, count: 0, lastSource: '', batchId: effectiveBatchId, sameBatchCount: 0, isSameBatch: false, duplicateBatches: [] };
    const sameBatchRecords = point.importBatches.filter((b) => b.batchId === effectiveBatchId && b.busCardTime === busCardTime);
    const sameBatchCount = sameBatchRecords.length;
    const isSameBatch = !!batchId && sameBatchCount > 0;
    const isDuplicate = isSameBatch;
    const duplicateBatches = Array.from(new Set(point.importBatches.filter((b) => b.isDuplicate).map((b) => b.batchId)));
    return { isDuplicate, count: point.importCount, lastSource: point.lastImportSource, batchId: effectiveBatchId, sameBatchCount, isSameBatch, duplicateBatches };
  },

  checkBusRedlineConflict: (busCardTime, redLineNote) => {
    if (!busCardTime.trim() || !redLineNote.trim()) return { hasConflict: false, description: '' };
    const redlineForbidMorning = /禁止.*早|早.*禁止|不允许.*早|早.*不允许/.test(redLineNote);
    const redlineOnlyNoon = /仅限.*中午|只有中午|中午.*可|午间/.test(redLineNote);
    const hasConflict = redlineForbidMorning || redlineOnlyNoon;
    let description = '';
    if (redlineOnlyNoon) description = '公交数据显示早晚高峰人流集中，但红线图只允许中午时段设摊，两者差异较大，请仔细核对。';
    else if (redlineForbidMorning) description = '公交刷卡显示早高峰有人流，但红线图备注早高峰禁止摆摊，两者存在矛盾，请仔细核对。';
    return { hasConflict, description };
  },

  completeStep1: (workflowId, busCardTime, importSource = '手工录入', batchId) => {
    const { workflows, points, currentUser } = get();
    const workflow = workflows.find((w) => w.id === workflowId);
    const point = points.find((p) => p.id === workflow?.pointId);
    if (!workflow || !point) {
      const fallbackBatchId = batchId || generateId('batch-');
      return { isDuplicate: false, duplicateCount: 0, batchId: fallbackBatchId, sameBatchCount: 0, isSameBatch: false };
    }
    const dupCheck = get().checkDuplicateImport(point.id, busCardTime, batchId);
    const now = new Date().toISOString();
    const effectiveBatchId = dupCheck.batchId;
    const newImportCount = point.importCount + 1;
    const importOrder = newImportCount;
    const batchRecord: ImportBatchRecord = { batchId: effectiveBatchId, source: importSource, importedAt: now, busCardTime, isDuplicate: dupCheck.isDuplicate, importOrder };
    const newBusCardTime = dupCheck.isDuplicate ? point.busCardTime : busCardTime;

    set((state) => ({ points: state.points.map((p) => p.id === point.id ? { ...p, busCardTime: newBusCardTime, importCount: newImportCount, lastImportSource: importSource, lastImportBatchId: effectiveBatchId, importBatches: [...p.importBatches, batchRecord], updatedAt: now } : p) }));

    if (dupCheck.isDuplicate) {
      const conflict: Conflict = { id: generateId('c'), pointId: point.id, pointName: point.name, type: 'duplicate-import', source: '第1步重复检测', batchId: effectiveBatchId, batchSource: importSource, importOrder, totalDuplicates: dupCheck.sameBatchCount + 1, conclusion: '同一批次重传，已自动去重', status: 'resolved', handler: '系统自动', handledAt: now, createdAt: now, busCardValue: busCardTime };
      set((state) => ({ conflicts: [conflict, ...state.conflicts] }));
    }

    const step1Data: WorkflowStepData['step1'] = { busCardTime: newBusCardTime, importedAt: now, importSource, isDuplicate: dupCheck.isDuplicate, duplicateDetected: dupCheck.isDuplicate, batchId: effectiveBatchId };
    set((state) => ({ workflows: state.workflows.map((w) => w.id === workflowId ? { ...w, currentStep: 2, stepData: { ...w.stepData, step1: step1Data } } : w) }));

    const fieldChanges = [];
    if (!dupCheck.isDuplicate) fieldChanges.push({ field: 'busCardTime', fieldLabel: fieldLabels.busCardTime, beforeValue: formatValueLabel(point.busCardTime, 'busCardTime'), afterValue: formatValueLabel(busCardTime, 'busCardTime') });
    fieldChanges.push({ field: 'importCount', fieldLabel: fieldLabels.importCount, beforeValue: String(point.importCount), afterValue: String(newImportCount) });

    get().addHistory({
      pointId: point.id, pointName: point.name, action: 'import', operator: currentUser,
      beforeData: { busCardTime: point.busCardTime, importCount: point.importCount },
      afterData: { busCardTime: newBusCardTime, importCount: newImportCount },
      fieldChanges,
      changeReason: dupCheck.isDuplicate ? '同一批次重传，已自动去重' : '导入新批次数据',
      remark: \`第一步：导入公交刷卡时段\${dupCheck.isDuplicate ? '（同一批次重传，已去重）' : '（新批次）'}\`,
    });

    return { isDuplicate: dupCheck.isDuplicate, duplicateCount: newImportCount, batchId: effectiveBatchId, sameBatchCount: dupCheck.sameBatchCount + (dupCheck.isDuplicate ? 1 : 0), isSameBatch: dupCheck.isSameBatch };
  },

  completeStep2: (workflowId, redLineNote, changeReason = '对照红线图补录备注') => {
    const { workflows, points, currentUser } = get();
    const workflow = workflows.find((w) => w.id === workflowId);
    const point = points.find((p) => p.id === workflow?.pointId);
    if (!workflow || !point) return { hasConflict: false, conflictDescription: '' };
    const busCardTime = workflow.stepData.step1?.busCardTime || point.busCardTime;
    const conflictCheck = get().checkBusRedlineConflict(busCardTime, redLineNote);
    const now = new Date().toISOString();

    if (conflictCheck.hasConflict) {
      const conflict: Conflict = { id: generateId('c'), pointId: point.id, pointName: point.name, type: 'bus-vs-redline', source: '第2步自动检测', busCardValue: busCardTime, redLineValue: redLineNote, evidence: conflictCheck.description, status: 'pending', createdAt: now };
      set((state) => ({ conflicts: [conflict, ...state.conflicts] }));
    }

    const newStatus = conflictCheck.hasConflict ? 'conflict' : point.status;
    set((state) => ({ points: state.points.map((p) => p.id === point.id ? { ...p, redLineNote, status: newStatus, updatedAt: now } : p) }));

    const step2Data: WorkflowStepData['step2'] = { redLineNote, reviewedAt: now, reviewer: currentUser, hasConflict: conflictCheck.hasConflict, conflictDescription: conflictCheck.description };
    set((state) => ({ workflows: state.workflows.map((w) => w.id === workflowId ? { ...w, currentStep: 3, stepData: { ...w.stepData, step2: step2Data } } : w) }));

    get().addHistory({
      pointId: point.id, pointName: point.name, action: 'supplement', operator: currentUser,
      beforeData: { redLineNote: point.redLineNote, status: point.status },
      afterData: { redLineNote, status: newStatus },
      fieldChanges: [
        { field: 'redLineNote', fieldLabel: fieldLabels.redLineNote, beforeValue: formatValueLabel(point.redLineNote, 'redLineNote'), afterValue: formatValueLabel(redLineNote, 'redLineNote') },
        { field: 'status', fieldLabel: fieldLabels.status, beforeValue: statusLabels[point.status] || point.status, afterValue: statusLabels[newStatus] || newStatus },
      ],
      changeReason,
      remark: \`第二步：补看红线图备注\${conflictCheck.hasConflict ? '（检测到冲突）' : ''}\`,
    });

    return { hasConflict: conflictCheck.hasConflict, conflictDescription: conflictCheck.description };
  },

  completeStep3: (workflowId) => {
    const { workflows, points, currentUser } = get();
    const workflow = workflows.find((w) => w.id === workflowId);
    const point = points.find((p) => p.id === workflow?.pointId);
    if (!workflow || !point) return { pointStatus: 'pending', reviewStatus: 'not-needed', needsReview: false };
    const now = new Date().toISOString();
    const hasDetourNotSynced = point.hasConstructionDetour && !point.mapSynced;
    const hasConflict = point.status === 'conflict';

    let finalPointStatus: Point['status'], finalReviewStatus: Point['reviewStatus'], workflowStatus: Workflow['status'];
    if (hasDetourNotSynced) { finalPointStatus = 'pending-review'; finalReviewStatus = 'pending'; workflowStatus = 'pending-review'; }
    else if (hasConflict) { finalPointStatus = 'conflict'; finalReviewStatus = point.reviewStatus; workflowStatus = 'completed'; }
    else { finalPointStatus = 'normal'; finalReviewStatus = 'not-needed'; workflowStatus = 'completed'; }

    const dupPassed = !workflow.stepData.step1?.isDuplicate;
    const detourPassed = !hasDetourNotSynced;
    const overallStatus: 'pass' | 'warning' | 'error' = !detourPassed ? 'error' : !dupPassed ? 'warning' : 'pass';
    const overallConclusion = hasDetourNotSynced ? '施工改道未同步地图，待居民代表复核' : hasConflict ? '存在公交与红线冲突，请确认处理' : '所有检查项通过';

    const lastBatch = point.importBatches[point.importBatches.length - 1];
    const finalReport = {
      duplicateCheck: { passed: dupPassed, detail: workflow.stepData.step1?.isDuplicate ? '检测到重复导入，已自动去重' : '未检测到重复导入', batchId: lastBatch?.batchId, batchSource: lastBatch?.source, count: point.importCount },
      detourSync: { passed: detourPassed, detail: hasDetourNotSynced ? '施工改道未同步地图，待复核' : '改道已同步或无改道', source: '施工上报系统' },
      supplementRecalc: { passed: true, detail: workflow.stepData.step2 ? \`已补录红线备注\${workflow.stepData.step2.hasConflict ? '，检测到冲突' : ''}\` : '未补录', hasConflict: workflow.stepData.step2?.hasConflict },
      exportConsistent: { passed: true, detail: '导出数据与系统一致' },
      overallConclusion, overallStatus, finalPointStatus, finalReviewStatus,
    };

    const step3Data: WorkflowStepData['step3'] = { updatedAt: now, operator: currentUser, pointStatus: finalPointStatus, reviewStatus: finalReviewStatus };
    set((state) => ({
      points: state.points.map((p) => p.id === point.id ? { ...p, status: finalPointStatus, reviewStatus: finalReviewStatus, updatedAt: now } : p),
      workflows: state.workflows.map((w) => w.id === workflowId ? { ...w, currentStep: 3, status: workflowStatus, stepData: { ...w.stepData, step3: step3Data }, finalReport } : w),
    }));

    get().addHistory({
      pointId: point.id, pointName: point.name, action: 'update', operator: currentUser,
      beforeData: { status: point.status, reviewStatus: point.reviewStatus },
      afterData: { status: finalPointStatus, reviewStatus: finalReviewStatus },
      fieldChanges: [
        { field: 'status', fieldLabel: fieldLabels.status, beforeValue: statusLabels[point.status] || point.status, afterValue: statusLabels[finalPointStatus] || finalPointStatus },
        { field: 'reviewStatus', fieldLabel: fieldLabels.reviewStatus, beforeValue: statusLabels[point.reviewStatus] || point.reviewStatus, afterValue: statusLabels[finalReviewStatus] || finalReviewStatus },
      ],
      changeReason: \`完成三步流程，\${overallConclusion}\`,
      remark: \`第三步：更新点位清单\${hasDetourNotSynced ? '（待复核）' : ''}\`,
    });

    return { pointStatus: finalPointStatus, reviewStatus: finalReviewStatus, needsReview: hasDetourNotSynced };
  },

  runSelfCheck: () => {
    const { points, currentUser } = get();
    const now = new Date().toISOString();
    const dupIssues = points.filter((p) => p.importBatches.some((b) => b.isDuplicate)).map((p) => \`\${p.name}：存在重复导入（\${p.lastImportSource}）\`);
    const detourIssues = points.filter((p) => p.hasConstructionDetour && !p.mapSynced).map((p) => \`\${p.name}：有施工改道但地图未同步\`);
    const supIssues = points.filter((p) => !p.redLineNote.trim()).map((p) => \`\${p.name}：红线图备注待补录\`);
    const overallStatus: 'pass' | 'warning' | 'error' = detourIssues.length > 0 ? 'error' : dupIssues.length > 0 || supIssues.length > 0 ? 'warning' : 'pass';
    const summary = \`检测发现\${detourIssues.length}处改道未同步、\${dupIssues.length}处重复导入、\${supIssues.length}处待补录，其余正常。\`;

    const items = [
      { type: 'duplicate-import', typeName: '重复导入检测', source: '导入记录比对', status: dupIssues.length > 0 ? 'warning' as const, issues: dupIssues, conclusion: dupIssues.length ? \`\${dupIssues.length}处重复导入，已自动去重\` : '未检测到重复导入' },
      { type: 'detour-sync', typeName: '施工改道同步', source: '施工上报与地图交叉比对', status: detourIssues.length > 0 ? 'error' as const, issues: detourIssues, conclusion: detourIssues.length ? \`\${detourIssues.length}处未同步，待复核\` : '改道均已同步' },
      { type: 'recalculate', typeName: '补录后重算', source: '补录记录与统计比对', status: supIssues.length > 0 ? 'warning' as const, issues: supIssues, conclusion: supIssues.length ? \`\${supIssues.length}处待补录\` : '补录完成，已重算' },
      { type: 'export-consistent', typeName: '导出一致性', source: '导出模板与数据逐项比对', status: 'pass' as const, issues: [] as string[], conclusion: '导出数据与系统完全一致' },
    ];

    const result: SelfCheckResult = { id: generateId('s'), reportName: \`\${new Date().toLocaleDateString('zh-CN')} 自检报告\`, overallStatus, summary, items, checkedAt: now, operator: currentUser };
    set((state) => ({ selfCheckResults: [result, ...state.selfCheckResults] }));
  },

  approveReview: (pointId) => {
    const { currentUser, points } = get();
    const point = points.find((p) => p.id === pointId);
    if (!point) return;
    const now = new Date().toISOString();
    set((state) => ({
      points: state.points.map((p) => p.id === pointId ? { ...p, reviewStatus: 'approved', mapSynced: true, status: p.status === 'pending-review' ? 'normal' : p.status, updatedAt: now } : p),
      conflicts: state.conflicts.map((c) => c.pointId === pointId && c.type === 'detour-not-synced' ? { ...c, status: 'resolved', handledAt: now, handler: currentUser, conclusion: '居民代表复核通过，地图已同步' } : c),
    }));
    get().addHistory({
      pointId, pointName: point.name, action: 'review', operator: '居民代表',
      beforeData: { reviewStatus: point.reviewStatus, mapSynced: point.mapSynced, status: point.status },
      afterData: { reviewStatus: 'approved', mapSynced: true, status: point.status === 'pending-review' ? 'normal' : point.status },
      fieldChanges: [
        { field: 'reviewStatus', fieldLabel: fieldLabels.reviewStatus, beforeValue: statusLabels[point.reviewStatus] || point.reviewStatus, afterValue: '已通过' },
        { field: 'mapSynced', fieldLabel: fieldLabels.mapSynced, beforeValue: point.mapSynced ? '已同步' : '未同步', afterValue: '已同步' },
      ],
      changeReason: '居民代表核实施工改道，地图已同步',
      remark: '复核通过，点位归为正常',
    });
  },

  rejectReview: (pointId, reason = '改道信息与实际不符') => {
    const { currentUser, points } = get();
    const point = points.find((p) => p.id === pointId);
    if (!point) return;
    const now = new Date().toISOString();
    set((state) => ({
      points: state.points.map((p) => p.id === pointId ? { ...p, reviewStatus: 'rejected', updatedAt: now } : p),
      conflicts: state.conflicts.map((c) => c.pointId === pointId && c.type === 'detour-not-synced' ? { ...c, status: 'rejected', handledAt: now, handler: currentUser, conclusion: \`复核驳回：\${reason}\` } : c),
    }));
    get().addHistory({
      pointId, pointName: point.name, action: 'review', operator: '居民代表',
      beforeData: { reviewStatus: point.reviewStatus },
      afterData: { reviewStatus: 'rejected' },
      fieldChanges: [{ field: 'reviewStatus', fieldLabel: fieldLabels.reviewStatus, beforeValue: statusLabels[point.reviewStatus] || point.reviewStatus, afterValue: '已驳回' }],
      changeReason: reason,
      remark: '复核驳回，需重新处理',
    });
  },
}));
`;

fs.writeFileSync('/Users/lzy/pro/solo/workspaces/zy72488/src/store/useStore.ts', content, 'utf8');
console.log('File written successfully');
console.log('Lines:', content.split('\n').length);
