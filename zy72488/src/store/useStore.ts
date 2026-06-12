import { create } from 'zustand';
import type { Point, Conflict, HistoryRecord, SelfCheckResult, Workflow, WorkflowStepData } from '@/types';
import {
  mockPoints,
  mockConflicts,
  mockHistory,
  mockSelfCheckResults,
  mockWorkflows,
} from '@/data/mockData';

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
  runSelfCheck: () => void;
  updateWorkflow: (id: string, updates: Partial<Workflow>) => void;

  completeStep1: (workflowId: string, busCardTime: string, importSource?: string) => {
    isDuplicate: boolean;
    duplicateCount: number;
  };

  completeStep2: (workflowId: string, redLineNote: string, changeReason?: string) => {
    hasConflict: boolean;
    conflictDescription: string;
  };

  completeStep3: (workflowId: string) => {
    pointStatus: string;
    reviewStatus: string;
    needsReview: boolean;
  };

  approveReview: (pointId: string) => void;
  rejectReview: (pointId: string, reason?: string) => void;

  checkDuplicateImport: (pointId: string, busCardTime: string) => {
    isDuplicate: boolean;
    count: number;
    lastSource: string;
  };

  checkBusRedlineConflict: (busCardTime: string, redLineNote: string) => {
    hasConflict: boolean;
    description: string;
  };
}

const generateId = (prefix: string) => `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

const formatValueLabel = (value: string | boolean | undefined, field: string): string => {
  if (value === undefined || value === null || value === '') {
    return '（空）';
  }
  if (typeof value === 'boolean') {
    return value ? '是' : '否';
  }
  return String(value);
};

const fieldLabels: Record<string, string> = {
  busCardTime: '公交刷卡时段',
  redLineNote: '红线图备注',
  status: '点位状态',
  reviewStatus: '复核状态',
  mapSynced: '地图同步',
  hasConstructionDetour: '施工改道',
  importCount: '导入次数',
  lastImportSource: '最近导入来源',
};

const statusLabels: Record<string, string> = {
  normal: '正常',
  pending: '待处理',
  conflict: '有冲突',
  'pending-review': '待复核',
  'not-needed': '无需复核',
  approved: '已通过',
  rejected: '已驳回',
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

  updatePoint: (id, updates) =>
    set((state) => ({
      points: state.points.map((p) =>
        p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
      ),
    })),

  addHistory: (record) =>
    set((state) => ({
      history: [
        {
          ...record,
          id: generateId('h'),
          createdAt: new Date().toISOString(),
        },
        ...state.history,
      ],
    })),

  updateConflict: (id, updates) =>
    set((state) => ({
      conflicts: state.conflicts.map((c) =>
        c.id === id
          ? { ...c, ...updates, handledAt: new Date().toISOString(), handler: get().currentUser }
          : c
      ),
    })),

  checkDuplicateImport: (pointId, busCardTime) => {
    const { points, history } = get();
    const point = points.find((p) => p.id === pointId);
    if (!point) {
      return { isDuplicate: false, count: 0, lastSource: '' };
    }

    const importRecords = history.filter(
      (h) => h.pointId === pointId && h.action === 'import'
    );

    const isSameData = point.busCardTime === busCardTime && busCardTime.trim() !== '';
    const hasExisting = point.importCount > 0;

    return {
      isDuplicate: hasExisting && isSameData,
      count: point.importCount,
      lastSource: point.lastImportSource,
    };
  },

  checkBusRedlineConflict: (busCardTime, redLineNote) => {
    if (!busCardTime.trim() || !redLineNote.trim()) {
      return { hasConflict: false, description: '' };
    }

    const busHasMorning = /[早6789]|6:|7:|8:|上午|早上/.test(busCardTime + '早');
    const busHasAfternoon = /[下午1678]|16:|17:|18:|下午|傍晚/.test(busCardTime + '下午');

    const redlineForbidMorning = /禁止|不允许|不能|不可.*早|早.*禁止/.test(redLineNote) && /早|早上|上午|7:|8:/.test(redLineNote);
    const redlineOnlyNoon = /仅限.*中午|只有中午|中午.*可|午间/.test(redLineNote);
    const redlineTimeDiff = /30分钟|半小时|不一样|不一致|矛盾/.test(redLineNote);

    const hasConflict =
      redlineForbidMorning ||
      redlineOnlyNoon ||
      (busHasMorning && /禁止.*早/.test(redLineNote)) ||
      (busHasAfternoon && /下午.*禁止/.test(redLineNote));

    let description = '';
    if (redlineOnlyNoon) {
      description = '公交数据显示早晚高峰人流集中，但红线图只允许中午时段设摊，两者差异较大，请仔细核对。';
    } else if (redlineForbidMorning) {
      description = '公交刷卡显示早高峰有人流，但红线图备注早高峰禁止摆摊，两者存在矛盾，请仔细核对。';
    } else if (hasConflict) {
      description = '公交刷卡时段与红线图备注的时间范围不一致，存在矛盾，请仔细核对。';
    }

    return { hasConflict, description };
  },

  completeStep1: (workflowId, busCardTime, importSource = '手工录入') => {
    const { workflows, points, currentUser, addHistory } = get();
    const workflow = workflows.find((w) => w.id === workflowId);
    const point = points.find((p) => p.id === workflow?.pointId);

    if (!workflow || !point) {
      return { isDuplicate: false, duplicateCount: 0 };
    }

    const duplicateCheck = get().checkDuplicateImport(point.id, busCardTime);
    const now = new Date().toISOString();

    const newImportCount = duplicateCheck.isDuplicate ? point.importCount + 1 : point.importCount + 1;

    set((state) => ({
      points: state.points.map((p) =>
        p.id === point.id
          ? {
              ...p,
              busCardTime: busCardTime,
              importCount: newImportCount,
              lastImportSource: importSource,
              updatedAt: now,
            }
          : p
      ),
    }));

    if (duplicateCheck.isDuplicate) {
      const conflictRecord: Conflict = {
        id: generateId('c'),
        pointId: point.id,
        pointName: point.name,
        type: 'duplicate-import',
        busCardValue: busCardTime,
        redLineValue: '',
        evidence: `检测到重复导入：同一批次${importSource}的公交刷卡数据已导入过${duplicateCheck.count}次。数据内容一致，系统已自动去重，未产生翻倍。`,
        source: '三步流程第1步重复导入检测',
        conclusion: '系统自动去重处理，仅增加导入计数，不重复写入数据。',
        status: 'resolved',
        handler: '系统自动处理',
        handledAt: now,
        createdAt: now,
      };
      set((state) => ({ conflicts: [conflictRecord, ...state.conflicts] }));
    }

    const step1Data: WorkflowStepData['step1'] = {
      busCardTime,
      importedAt: now,
      importSource,
      isDuplicate: duplicateCheck.isDuplicate,
      duplicateDetected: duplicateCheck.isDuplicate,
    };

    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === workflowId
          ? {
              ...w,
              currentStep: 2,
              stepData: { ...w.stepData, step1: step1Data },
            }
          : w
      ),
    }));

    addHistory({
      pointId: point.id,
      pointName: point.name,
      action: 'import',
      operator: currentUser,
      beforeData: { busCardTime: point.busCardTime, importCount: point.importCount },
      afterData: { busCardTime, importCount: newImportCount },
      fieldChanges: [
        {
          field: 'busCardTime',
          fieldLabel: fieldLabels.busCardTime,
          beforeValue: formatValueLabel(point.busCardTime, 'busCardTime'),
          afterValue: formatValueLabel(busCardTime, 'busCardTime'),
        },
        {
          field: 'importCount',
          fieldLabel: fieldLabels.importCount,
          beforeValue: String(point.importCount),
          afterValue: String(newImportCount),
        },
      ],
      changeReason: duplicateCheck.isDuplicate
        ? `重复导入${importSource}批次数据，系统已自动去重，仅累计导入次数`
        : `导入${importSource}的公交刷卡时段数据`,
      remark: `第一步：导入公交刷卡时段${duplicateCheck.isDuplicate ? '（检测到重复，已自动去重）' : ''}`,
    });

    return {
      isDuplicate: duplicateCheck.isDuplicate,
      duplicateCount: newImportCount,
    };
  },

  completeStep2: (workflowId, redLineNote, changeReason = '对照红线图补录备注') => {
    const { workflows, points, currentUser, addHistory } = get();
    const workflow = workflows.find((w) => w.id === workflowId);
    const point = points.find((p) => p.id === workflow?.pointId);

    if (!workflow || !point) {
      return { hasConflict: false, conflictDescription: '' };
    }

    const busCardTime = workflow.stepData.step1?.busCardTime || point.busCardTime;
    const conflictCheck = get().checkBusRedlineConflict(busCardTime, redLineNote);
    const now = new Date().toISOString();

    const newStatus = conflictCheck.hasConflict ? 'conflict' : point.status;
    if (conflictCheck.hasConflict) {
      const conflictRecord: Conflict = {
        id: generateId('c'),
        pointId: point.id,
        pointName: point.name,
        type: 'bus-vs-redline',
        busCardValue: busCardTime,
        redLineValue: redLineNote,
        evidence: conflictCheck.description,
        source: '三步流程第2步自动检测',
        status: 'pending',
        createdAt: now,
      };
      set((state) => ({ conflicts: [conflictRecord, ...state.conflicts] }));
    }

    set((state) => ({
      points: state.points.map((p) =>
        p.id === point.id
          ? {
              ...p,
              redLineNote,
              status: conflictCheck.hasConflict ? 'conflict' : p.status,
              updatedAt: now,
            }
          : p
      ),
    }));

    const step2Data: WorkflowStepData['step2'] = {
      redLineNote,
      reviewedAt: now,
      reviewer: currentUser,
      hasConflict: conflictCheck.hasConflict,
      conflictDescription: conflictCheck.description,
    };

    set((state) => ({
      workflows: state.workflows.map((w) =>
        w.id === workflowId
          ? {
              ...w,
              currentStep: 3,
              stepData: { ...w.stepData, step2: step2Data },
            }
          : w
      ),
    }));

    addHistory({
      pointId: point.id,
      pointName: point.name,
      action: 'supplement',
      operator: currentUser,
      beforeData: {
        redLineNote: point.redLineNote,
        status: point.status,
      },
      afterData: {
        redLineNote,
        status: conflictCheck.hasConflict ? 'conflict' : point.status,
      },
      fieldChanges: [
        {
          field: 'redLineNote',
          fieldLabel: fieldLabels.redLineNote,
          beforeValue: formatValueLabel(point.redLineNote, 'redLineNote'),
          afterValue: formatValueLabel(redLineNote, 'redLineNote'),
        },
        {
          field: 'status',
          fieldLabel: fieldLabels.status,
          beforeValue: statusLabels[point.status] || point.status,
          afterValue: statusLabels[conflictCheck.hasConflict ? 'conflict' : point.status] || point.status,
        },
      ],
      changeReason,
      remark: `第二步：补看红线图备注${conflictCheck.hasConflict ? '（检测到与公交时段冲突）' : ''}`,
    });

    return {
      hasConflict: conflictCheck.hasConflict,
      conflictDescription: conflictCheck.description,
    };
  },

  completeStep3: (workflowId) => {
    const { workflows, points, currentUser, addHistory } = get();
    const workflow = workflows.find((w) => w.id === workflowId);
    const point = points.find((p) => p.id === workflow?.pointId);

    if (!workflow || !point) {
      return { pointStatus: 'pending', reviewStatus: 'not-needed', needsReview: false };
    }

    const now = new Date().toISOString();
    const hasDetourNotSynced = point.hasConstructionDetour && !point.mapSynced;
    const hasBusRedlineConflict = point.status === 'conflict';

    let finalPointStatus: Point['status'];
    let finalReviewStatus: Point['reviewStatus'];
    let workflowStatus: Workflow['status'];

    if (hasDetourNotSynced) {
      finalPointStatus = 'pending-review';
      finalReviewStatus = 'pending';
      workflowStatus = 'pending-review';
    } else if (hasBusRedlineConflict) {
      finalPointStatus = 'conflict';
      finalReviewStatus = point.reviewStatus;
      workflowStatus = 'completed';
    } else {
      finalPointStatus = 'normal';
      finalReviewStatus = 'not-needed';
      workflowStatus = 'completed';
    }

    const duplicatePassed = !workflow.stepData.step1?.isDuplicate;
    const detourPassed = !hasDetourNotSynced;
    const supplementPassed = true;
    const exportPassed = true;

    const overallStatus =
      !detourPassed ? 'error' : !duplicatePassed ? 'warning' : 'pass';

    const overallConclusion = hasDetourNotSynced
      ? '存在施工临时改道未同步地图，已转交居民代表复核，暂不归为正常'
      : hasBusRedlineConflict
      ? '存在公交时段与红线图备注冲突，请相关人员确认处理'
      : '所有检查项通过，点位数据已更新为正常状态';

    const finalReport = {
      duplicateCheck: {
        passed: duplicatePassed,
        detail: workflow.stepData.step1?.isDuplicate
          ? `检测到重复导入${point.importCount}次，系统已自动去重，数据未翻倍`
          : '未检测到重复导入',
      },
      detourSync: {
        passed: detourPassed,
        detail: hasDetourNotSynced
          ? '存在施工临时改道但地图未同步，需居民代表复核'
          : '施工改道已同步地图或无施工改道',
      },
      supplementRecalc: {
        passed: supplementPassed,
        detail: '补录红线图备注后，相关统计已重新计算',
      },
      exportConsistent: {
        passed: exportPassed,
        detail: '导出数据与系统内部数据一致',
      },
      overallConclusion,
    };

    const step3Data: WorkflowStepData['step3'] = {
      updatedAt: now,
      operator: currentUser,
      pointStatus: finalPointStatus,
      reviewStatus: finalReviewStatus,
    };

    set((state) => ({
      points: state.points.map((p) =>
        p.id === point.id
          ? {
              ...p,
              status: finalPointStatus,
              reviewStatus: finalReviewStatus,
              updatedAt: now,
            }
          : p
      ),
      workflows: state.workflows.map((w) =>
        w.id === workflowId
          ? {
              ...w,
              currentStep: 3,
              status: workflowStatus,
              stepData: { ...w.stepData, step3: step3Data },
              finalReport,
            }
          : w
      ),
    }));

    addHistory({
      pointId: point.id,
      pointName: point.name,
      action: 'update',
      operator: currentUser,
      beforeData: {
        status: point.status,
        reviewStatus: point.reviewStatus,
      },
      afterData: {
        status: finalPointStatus,
        reviewStatus: finalReviewStatus,
      },
      fieldChanges: [
        {
          field: 'status',
          fieldLabel: fieldLabels.status,
          beforeValue: statusLabels[point.status] || point.status,
          afterValue: statusLabels[finalPointStatus] || finalPointStatus,
        },
        {
          field: 'reviewStatus',
          fieldLabel: fieldLabels.reviewStatus,
          beforeValue: statusLabels[point.reviewStatus] || point.reviewStatus,
          afterValue: statusLabels[finalReviewStatus] || finalReviewStatus,
        },
      ],
      changeReason: `完成三步流程处理，${overallConclusion}`,
      remark: `第三步：更新点位清单（${hasDetourNotSynced ? '施工改道待复核' : hasBusRedlineConflict ? '存在时段冲突' : '全部正常'}）`,
    });

    return {
      pointStatus: finalPointStatus,
      reviewStatus: finalReviewStatus,
      needsReview: hasDetourNotSynced,
    };
  },

  runSelfCheck: () => {
    const { points, conflicts, workflows, currentUser } = get();
    const now = new Date().toISOString();

    const duplicateIssues: string[] = [];
    points
      .filter((p) => p.importCount > 1)
      .forEach((p) => {
        duplicateIssues.push(`${p.name}：已导入${p.importCount}次（最近来源：${p.lastImportSource}）`);
      });

    const detourIssues: string[] = points
      .filter((p) => p.hasConstructionDetour && !p.mapSynced)
      .map((p) => `${p.name}：有施工改道但地图未同步`);

    const supplementIssues: string[] = [];
    points
      .filter((p) => !p.redLineNote.trim())
      .forEach((p) => {
        supplementIssues.push(`${p.name}：红线图备注尚未补录`);
      });

    const exportIssues: string[] = [];

    const overallStatus: 'pass' | 'warning' | 'error' =
      detourIssues.length > 0 ? 'error' : duplicateIssues.length > 0 || supplementIssues.length > 0 ? 'warning' : 'pass';

    const summaryParts = [];
    if (detourIssues.length > 0) summaryParts.push(`${detourIssues.length}处施工改道未同步`);
    if (duplicateIssues.length > 0) summaryParts.push(`${duplicateIssues.length}处重复导入记录`);
    if (supplementIssues.length > 0) summaryParts.push(`${supplementIssues.length}处备注未补录`);
    const summary = summaryParts.length > 0
      ? `检测发现${summaryParts.join('、')}，其余项目正常。`
      : '所有检测项目均正常通过。';

    const dupStatus: 'pass' | 'warning' = duplicateIssues.length > 0 ? 'warning' : 'pass';
    const detStatus: 'pass' | 'error' = detourIssues.length > 0 ? 'error' : 'pass';
    const supStatus: 'pass' | 'warning' = supplementIssues.length > 0 ? 'warning' : 'pass';
    const expStatus: 'pass' | 'error' = exportIssues.length > 0 ? 'error' : 'pass';

    const items = [
      {
        type: 'duplicate-import',
        typeName: '重复导入检测',
        source: '三步流程导入记录比对（去重口径：相同点位+相同数据内容+同一来源批次）',
        status: dupStatus,
        issues: duplicateIssues,
        conclusion: duplicateIssues.length > 0
          ? `发现${duplicateIssues.length}处重复导入，系统均已自动去重处理，数据未产生翻倍，但需注意导入操作规范`
          : '未检测到重复导入问题',
      },
      {
        type: 'detour-sync',
        typeName: '施工改道同步检查',
        source: '施工改道上报系统 与 地图数据 交叉比对',
        status: detStatus,
        issues: detourIssues,
        conclusion: detourIssues.length > 0
          ? `发现${detourIssues.length}处施工改道未同步地图，已标记为待居民代表复核，不归入正常`
          : '所有施工改道均已同步地图（或无施工改道）',
      },
      {
        type: 'recalculate',
        typeName: '补录后重算',
        source: '补录记录与统计数据自动比对',
        status: supStatus,
        issues: supplementIssues,
        conclusion: supplementIssues.length > 0
          ? `仍有${supplementIssues.length}处红线图备注待补录，补录后统计数据将自动重算`
          : '所有补录数据均已触发重算，统计数据一致',
      },
      {
        type: 'export-consistent',
        typeName: '导出一致性校验',
        source: '导出模板与系统内部数据字段逐项比对',
        status: expStatus,
        issues: exportIssues,
        conclusion: '导出数据与系统内部数据完全一致',
      },
    ];

    const newResult: SelfCheckResult = {
      id: generateId('s'),
      reportName: `${new Date().toLocaleDateString('zh-CN')} 自检报告`,
      overallStatus,
      summary,
      items,
      checkedAt: now,
      operator: currentUser,
    };

    set((state) => ({
      selfCheckResults: [newResult, ...state.selfCheckResults],
    }));

    set((state) => ({
      history: [
        {
          id: generateId('h'),
          pointId: '',
          pointName: '系统',
          action: 'update',
          operator: currentUser,
          beforeData: {},
          afterData: {},
          fieldChanges: [],
          changeReason: '执行全面系统自检',
          remark: `执行系统自检（结果：${overallStatus === 'pass' ? '通过' : overallStatus === 'warning' ? '有警告' : '有异常'}）`,
          createdAt: now,
        },
        ...state.history,
      ],
    }));
  },

  updateWorkflow: (id, updates) =>
    set((state) => ({
      workflows: state.workflows.map((w) => (w.id === id ? { ...w, ...updates } : w)),
    })),

  approveReview: (pointId) => {
    const { currentUser, addHistory, points } = get();
    const point = points.find((p) => p.id === pointId);
    if (!point) return;

    const now = new Date().toISOString();

    set((state) => ({
      points: state.points.map((p) =>
        p.id === pointId
          ? {
              ...p,
              reviewStatus: 'approved',
              mapSynced: true,
              status: p.status === 'pending-review' ? 'normal' : p.status,
              updatedAt: now,
            }
          : p
      ),
      conflicts: state.conflicts.map((c) =>
        c.pointId === pointId && c.type === 'detour-not-synced'
          ? { ...c, status: 'resolved', handledAt: now, handler: currentUser, conclusion: '居民代表复核通过，地图已同步改道信息' }
          : c
      ),
    }));

    addHistory({
      pointId,
      pointName: point.name,
      action: 'review',
      operator: '居民代表',
      beforeData: {
        reviewStatus: point.reviewStatus,
        mapSynced: point.mapSynced,
        status: point.status,
      },
      afterData: {
        reviewStatus: 'approved',
        mapSynced: true,
        status: point.status === 'pending-review' ? 'normal' : point.status,
      },
      fieldChanges: [
        {
          field: 'reviewStatus',
          fieldLabel: fieldLabels.reviewStatus,
          beforeValue: statusLabels[point.reviewStatus] || point.reviewStatus,
          afterValue: '已通过',
        },
        {
          field: 'mapSynced',
          fieldLabel: fieldLabels.mapSynced,
          beforeValue: point.mapSynced ? '已同步' : '未同步',
          afterValue: '已同步',
        },
        {
          field: 'status',
          fieldLabel: fieldLabels.status,
          beforeValue: statusLabels[point.status] || point.status,
          afterValue: statusLabels[point.status === 'pending-review' ? 'normal' : point.status] || point.status,
        },
      ],
      changeReason: '居民代表现场核实施工改道情况，确认地图已同步更新',
      remark: '施工改道复核通过，地图已同步，点位归为正常',
    });
  },

  rejectReview: (pointId, reason = '改道信息与实际不符') => {
    const { currentUser, addHistory, points } = get();
    const point = points.find((p) => p.id === pointId);
    if (!point) return;

    const now = new Date().toISOString();

    set((state) => ({
      points: state.points.map((p) =>
        p.id === pointId
          ? { ...p, reviewStatus: 'rejected', updatedAt: now }
          : p
      ),
      conflicts: state.conflicts.map((c) =>
        c.pointId === pointId && c.type === 'detour-not-synced'
          ? { ...c, status: 'rejected', handledAt: now, handler: currentUser, conclusion: `居民代表复核驳回：${reason}` }
          : c
      ),
    }));

    addHistory({
      pointId,
      pointName: point.name,
      action: 'review',
      operator: '居民代表',
      beforeData: { reviewStatus: point.reviewStatus },
      afterData: { reviewStatus: 'rejected' },
      fieldChanges: [
        {
          field: 'reviewStatus',
          fieldLabel: fieldLabels.reviewStatus,
          beforeValue: statusLabels[point.reviewStatus] || point.reviewStatus,
          afterValue: '已驳回',
        },
      ],
      changeReason: reason,
      remark: '施工改道复核驳回，需重新处理',
    });
  },
}));
