import type { Point, Conflict, HistoryRecord, SelfCheckResult, Workflow, ImportBatchRecord } from '@/types';

const batchA = 'batch-2026-06-A';
const batchB = 'batch-2026-06-B';

const p1Batches: ImportBatchRecord[] = [
  { batchId: batchA, source: '公交公司2026-06-A批次', importedAt: '2026-06-05T10:00:00.000Z', busCardTime: '7:00-8:30, 16:00-18:00', isDuplicate: false, importOrder: 1 },
  { batchId: batchA, source: '公交公司2026-06-A批次', importedAt: '2026-06-05T14:30:00.000Z', busCardTime: '7:00-8:30, 16:00-18:00', isDuplicate: true, importOrder: 2 },
];

const p5Batches: ImportBatchRecord[] = [
  { batchId: batchB, source: '公交公司2026-06-B批次', importedAt: '2026-06-06T08:00:00.000Z', busCardTime: '7:00-8:00, 16:00-17:30', isDuplicate: false, importOrder: 1 },
];

const mkBatch = (batch: string, time: string, busTime: string): ImportBatchRecord[] => [
  { batchId: batch, source: `公交公司${batch}批次`, importedAt: time, busCardTime: busTime, isDuplicate: false, importOrder: 1 },
];

export const mockPoints: Point[] = [
  { id: 'p1', name: '实验小学东门', location: '实验小学东门北侧50米', busCardTime: '7:00-8:30, 16:00-18:00', redLineNote: '早7:30-8:30禁止摆摊，下午16:30后可设摊', status: 'pending-review', hasConstructionDetour: true, mapSynced: false, reviewStatus: 'pending', importCount: 2, lastImportSource: '公交公司2026-06-A批次', lastImportBatchId: batchA, importBatches: p1Batches, createdAt: '2026-06-01T09:00:00.000Z', updatedAt: '2026-06-05T14:30:00.000Z' },
  { id: 'p2', name: '第一中学南门', location: '第一中学南门对面人行道', busCardTime: '6:30-7:30, 17:00-18:30', redLineNote: '早6:30-7:30、晚17:00-18:30设摊', status: 'normal', hasConstructionDetour: false, mapSynced: true, reviewStatus: 'not-needed', importCount: 1, lastImportSource: '公交公司2026-06-A批次', lastImportBatchId: batchA, importBatches: mkBatch(batchA, '2026-06-02T10:00:00.000Z', '6:30-7:30, 17:00-18:30'), createdAt: '2026-06-01T09:00:00.000Z', updatedAt: '2026-06-03T10:15:00.000Z' },
  { id: 'p3', name: '育才小学西门', location: '育才小学西侧路口', busCardTime: '7:15-8:00, 15:45-17:00', redLineNote: '早7:00-8:00、下午15:30-17:00可设摊', status: 'normal', hasConstructionDetour: true, mapSynced: true, reviewStatus: 'approved', importCount: 1, lastImportSource: '公交公司2026-06-A批次', lastImportBatchId: batchA, importBatches: mkBatch(batchA, '2026-06-03T11:00:00.000Z', '7:15-8:00, 15:45-17:00'), createdAt: '2026-06-02T11:00:00.000Z', updatedAt: '2026-06-05T09:00:00.000Z' },
  { id: 'p4', name: '向阳中学北门', location: '向阳中学北门东侧', busCardTime: '6:45-7:45, 16:30-18:00', redLineNote: '早高峰禁止设摊，仅限中午11:30-12:30', status: 'conflict', hasConstructionDetour: false, mapSynced: true, reviewStatus: 'not-needed', importCount: 1, lastImportSource: '公交公司2026-06-A批次', lastImportBatchId: batchA, importBatches: mkBatch(batchA, '2026-06-04T14:00:00.000Z', '6:45-7:45, 16:30-18:00'), createdAt: '2026-06-02T14:00:00.000Z', updatedAt: '2026-06-04T16:45:00.000Z' },
  { id: 'p5', name: '光明小学正门', location: '光明小学正门口', busCardTime: '7:00-8:00, 16:00-17:30', redLineNote: '', status: 'pending', hasConstructionDetour: true, mapSynced: false, reviewStatus: 'pending', importCount: 1, lastImportSource: '公交公司2026-06-B批次', lastImportBatchId: batchB, importBatches: p5Batches, createdAt: '2026-06-03T08:30:00.000Z', updatedAt: '2026-06-06T11:20:00.000Z' },
];

export const mockConflicts: Conflict[] = [
  { id: 'c1', pointId: 'p1', pointName: '实验小学东门', type: 'bus-vs-redline', source: '第2步自动检测', busCardValue: '7:00-8:30, 16:00-18:00', redLineValue: '早7:30-8:30禁止摆摊，下午16:30后可设摊', evidence: '公交早高峰7:00开始，但红线7:30才允许，有30分钟差异', status: 'pending', createdAt: '2026-06-05T14:35:00.000Z' },
  { id: 'c2', pointId: 'p4', pointName: '向阳中学北门', type: 'bus-vs-redline', source: '第2步自动检测', busCardValue: '6:45-7:45, 16:30-18:00', redLineValue: '早高峰禁止设摊，仅限中午', evidence: '公交早晚高峰人流集中，但红线完全禁止', status: 'pending', createdAt: '2026-06-04T16:50:00.000Z' },
  { id: 'c3', pointId: 'p1', pointName: '实验小学东门', type: 'detour-not-synced', source: '施工队上报', evidence: '东门北侧道路封闭，需绕行南侧入口，地图未同步', status: 'pending', createdAt: '2026-06-05T10:00:00.000Z' },
  { id: 'c4', pointId: 'p5', pointName: '光明小学正门', type: 'detour-not-synced', source: '地铁项目部上报', evidence: '正门前方地铁施工，需从东侧侧门绕行，地图未同步', status: 'pending', createdAt: '2026-06-06T08:00:00.000Z' },
  { id: 'c5', pointId: 'p1', pointName: '实验小学东门', type: 'duplicate-import', source: '第1步重复检测', batchId: batchA, batchSource: '公交公司2026-06-A批次', importOrder: 2, totalDuplicates: 2, conclusion: '同一批次重传，已自动去重', status: 'resolved', handler: '系统自动', handledAt: '2026-06-05T14:30:00.000Z', createdAt: '2026-06-05T14:30:00.000Z' },
];

const mkHistory = (id: string, pid: string, pname: string, action: HistoryRecord['action'], op: string, changes: Array<{ f: string; l: string; b: string; a: string }>, reason: string, remark: string, time: string): HistoryRecord => ({
  id, pointId: pid, pointName: pname, action, operator: op, beforeData: {}, afterData: {},
  fieldChanges: changes.map(c => ({ field: c.f, fieldLabel: c.l, beforeValue: c.b, afterValue: c.a })),
  changeReason: reason, remark, createdAt: time,
});

export const mockHistory: HistoryRecord[] = [
  mkHistory('h1', 'p1', '实验小学东门', 'import', '老马', [{ f: 'busCardTime', l: '公交刷卡时段', b: '（空）', a: '7:00-8:30, 16:00-18:00' }, { f: 'importCount', l: '导入次数', b: '0', a: '1' }], '首次导入2026-06-A批次', '第一步：第1次导入（新批次）', '2026-06-05T10:00:00.000Z'),
  mkHistory('h2', 'p1', '实验小学东门', 'import', '老马', [{ f: 'importCount', l: '导入次数', b: '1', a: '2' }], '同一批次重传，已去重', '第一步：第2次导入（重传，已去重）', '2026-06-05T14:30:00.000Z'),
  mkHistory('h3', 'p1', '实验小学东门', 'supplement', '老马', [{ f: 'redLineNote', l: '红线图备注', b: '（空）', a: '早7:30-8:30禁止摆摊' }, { f: 'status', l: '点位状态', b: 'pending', a: 'conflict' }], '补录红线图备注，检测到冲突', '第二步：补看红线图', '2026-06-05T14:35:00.000Z'),
  mkHistory('h4', 'p1', '实验小学东门', 'update', '老马', [{ f: 'status', l: '点位状态', b: 'conflict', a: 'pending-review' }], '完成三步流程，转交复核', '第三步：更新点位状态（待复核）', '2026-06-05T15:00:00.000Z'),
  mkHistory('h5', 'p3', '育才小学西门', 'supplement', '老马', [{ f: 'redLineNote', l: '红线图备注', b: '（空）', a: '早7:00-8:00可设摊' }], '补录红线图备注', '第二步：补看红线图', '2026-06-05T09:00:00.000Z'),
  mkHistory('h6', 'p3', '育才小学西门', 'review', '居民代表王阿姨', [{ f: 'reviewStatus', l: '复核状态', b: 'pending', a: 'approved' }, { f: 'status', l: '点位状态', b: 'pending-review', a: 'normal' }], '施工改道复核通过，地图已同步', '复核通过，点位归正常', '2026-06-05T10:30:00.000Z'),
  mkHistory('h7', 'p2', '第一中学南门', 'create', '业务小李', [], '新增点位基础信息', '新增点位', '2026-06-01T09:00:00.000Z'),
  mkHistory('h8', 'p4', '向阳中学北门', 'import', '老马', [{ f: 'busCardTime', l: '公交刷卡时段', b: '（空）', a: '6:45-7:45, 16:30-18:00' }], '首次导入2026-06-A批次', '第一步：导入公交时段', '2026-06-04T16:45:00.000Z'),
  mkHistory('h9', 'p5', '光明小学正门', 'import', '老马', [{ f: 'busCardTime', l: '公交刷卡时段', b: '（空）', a: '7:00-8:00, 16:00-17:30' }], '首次导入2026-06-B批次', '第一步：导入公交时段（新批次）', '2026-06-06T08:00:00.000Z'),
];

export const mockSelfCheckResults: SelfCheckResult[] = [
  {
    id: 's1', reportName: '2026年6月第1次自检报告', overallStatus: 'error',
    summary: '发现2处施工改道未同步地图，1处重复导入（已去重），其余正常。',
    items: [
      { type: 'duplicate-import', typeName: '重复导入检测', source: '导入记录比对（同点位+同批次+同内容）', status: 'warning', issues: ['实验小学东门：batch-2026-06-A被导入2次，已自动去重'], conclusion: '1处重复导入，系统已自动去重，数据未翻倍。' },
      { type: 'detour-sync', typeName: '施工改道同步', source: '施工上报系统与地图数据交叉比对', status: 'error', issues: ['实验小学东门：有改道但地图未同步', '光明小学正门：有改道但地图未同步'], conclusion: '2处未同步，已标记待居民代表复核。' },
      { type: 'recalculate', typeName: '补录后重算', source: '补录记录与统计数据自动比对', status: 'warning', issues: ['光明小学正门：红线图备注待补录'], conclusion: '1处待补录，补录后自动重算。' },
      { type: 'export-consistent', typeName: '导出一致性', source: '导出模板与系统数据逐项比对', status: 'pass', issues: [], conclusion: '导出数据与系统内部完全一致。' },
    ],
    checkedAt: new Date().toISOString(), operator: '老马',
  },
];

export const mockWorkflows: Workflow[] = [
  {
    id: 'w1', pointId: 'p5', pointName: '光明小学正门', currentStep: 1, status: 'in-progress',
    stepData: { step1: { busCardTime: '7:00-8:00, 16:00-17:30', importedAt: '2026-06-06T08:00:00.000Z', importSource: '公交公司2026-06-B批次', isDuplicate: false, duplicateDetected: false, batchId: batchB } },
    createdAt: '2026-06-06T11:20:00.000Z',
  },
  {
    id: 'w2', pointId: 'p1', pointName: '实验小学东门', currentStep: 3, status: 'pending-review',
    stepData: {
      step1: { busCardTime: '7:00-8:30, 16:00-18:00', importedAt: '2026-06-05T14:30:00.000Z', importSource: '公交公司2026-06-A批次', isDuplicate: true, duplicateDetected: true, batchId: batchA },
      step2: { redLineNote: '早7:30-8:30禁止摆摊', reviewedAt: '2026-06-05T14:35:00.000Z', reviewer: '老马', hasConflict: true, conflictDescription: '公交早高峰与红线禁摊时段存在矛盾' },
      step3: { updatedAt: '2026-06-05T15:00:00.000Z', operator: '老马', pointStatus: 'pending-review', reviewStatus: 'pending' },
    },
    finalReport: {
      duplicateCheck: { passed: false, detail: '同一批次重复导入2次，已自动去重', batchId: batchA, batchSource: '公交公司2026-06-A批次', count: 2 },
      detourSync: { passed: false, detail: '施工改道未同步地图，待居民代表复核', source: '施工队上报' },
      supplementRecalc: { passed: true, detail: '红线备注已补录，检测到冲突并生成记录', hasConflict: true },
      exportConsistent: { passed: true, detail: '导出数据与系统一致' },
      overallConclusion: '施工改道未同步，待复核；重复导入已去重；公交与红线有冲突需确认。',
      overallStatus: 'warning',
      finalPointStatus: 'pending-review',
      finalReviewStatus: 'pending',
    },
    createdAt: '2026-06-05T10:00:00.000Z',
  },
];
      { type: 'export-consistent', typeName: '导出一致性', source: '导出模板与系统数据逐项比对', status: 'pass', issues: [], conclusion: '导出数据与系统内部完全一致。' },
    ],
    checkedAt: now, operator: '老马',
  },
];

export const mockWorkflows: Workflow[] = [
  {
    id: 'w1', pointId: 'p5', pointName: '光明小学正门', currentStep: 1, status: 'in-progress',
    stepData: { step1: { busCardTime: '7:00-8:00, 16:00-17:30', importedAt: '2026-06-06T08:00:00.000Z', importSource: '公交公司2026-06-B批次', isDuplicate: false, duplicateDetected: false } },
    createdAt: '2026-06-06T11:20:00.000Z',
  },
  {
    id: 'w2', pointId: 'p1', pointName: '实验小学东门', currentStep: 3, status: 'pending-review',
    stepData: {
      step1: { busCardTime: '7:00-8:30, 16:00-18:00', importedAt: '2026-06-05T14:30:00.000Z', importSource: '公交公司2026-06-A批次', isDuplicate: true, duplicateDetected: true },
      step2: { redLineNote: '早7:30-8:30禁止摆摊', reviewedAt: '2026-06-05T14:35:00.000Z', reviewer: '老马', hasConflict: true, conflictDescription: '公交早高峰与红线禁摊时段存在矛盾' },
      step3: { updatedAt: '2026-06-05T15:00:00.000Z', operator: '老马', pointStatus: 'pending-review', reviewStatus: 'pending' },
    },
    finalReport: {
      duplicateCheck: { passed: false, detail: '同一批次重复导入2次，已自动去重' },
      detourSync: { passed: false, detail: '施工改道未同步地图，待居民代表复核' },
      supplementRecalc: { passed: true, detail: '红线备注已补录，检测到冲突并生成记录' },
      exportConsistent: { passed: true, detail: '导出数据与系统一致' },
      overallConclusion: '施工改道未同步，待复核；重复导入已去重；公交与红线有冲突需确认。',
    },
    createdAt: '2026-06-05T10:00:00.000Z',
  },
];
    summary: '发现2处施工改道未同步地图，1处重复导入（已去重），其余正常。',
    items: [
      { type: 'duplicate-import', typeName: '重复导入检测', source: '导入记录比对（同点位+同批次+同内容）', status: 'warning', issues: ['实验小学东门：batch-2026-06-A被导入2次，已自动去重'], conclusion: '1处重复导入，系统已自动去重，数据未翻倍。' },
      { type: 'detour-sync', typeName: '施工改道同步', source: '施工上报系统与地图数据交叉比对', status: 'error', issues: ['实验小学东门：有改道但地图未同步', '光明小学正门：有改道但地图未同步'], conclusion: '2处未同步，已标记待居民代表复核。' },
      { type: 'recalculate', typeName: '补录后重算', source: '补录记录与统计数据自动比对', status: 'warning', issues: ['光明小学正门：红线图备注待补录'], conclusion: '1处待补录，补录后自动重算。' },
      { type: 'export-consistent', typeName: '导出一致性', source: '导出模板与系统数据逐项比对', status: 'pass', issues: [], conclusion: '导出数据与系统内部完全一致。' },
    ],
    checkedAt: now, operator: '老马',
  },
];

export const mockWorkflows: Workflow[] = [
  {
    id: 'w1', pointId: 'p5', pointName: '光明小学正门', currentStep: 1, status: 'in-progress',
    stepData: { step1: { busCardTime: '7:00-8:00, 16:00-17:30', importedAt: '2026-06-06T08:00:00.000Z', importSource: '公交公司2026-06-B批次', isDuplicate: false, duplicateDetected: false } },
    createdAt: '2026-06-06T11:20:00.000Z',
  },
  {
    id: 'w2', pointId: 'p1', pointName: '实验小学东门', currentStep: 3, status: 'pending-review',
    stepData: {
      step1: { busCardTime: '7:00-8:30, 16:00-18:00', importedAt: '2026-06-05T14:30:00.000Z', importSource: '公交公司2026-06-A批次', isDuplicate: true, duplicateDetected: true },
      step2: { redLineNote: '早7:30-8:30禁止摆摊', reviewedAt: '2026-06-05T14:35:00.000Z', reviewer: '老马', hasConflict: true, conflictDescription: '公交早高峰与红线禁摊时段存在矛盾' },
      step3: { updatedAt: '2026-06-05T15:00:00.000Z', operator: '老马', pointStatus: 'pending-review', reviewStatus: 'pending' },
    },
    finalReport: {
      duplicateCheck: { passed: false, detail: '同一批次重复导入2次，已自动去重' },
      detourSync: { passed: false, detail: '施工改道未同步地图，待居民代表复核' },
      supplementRecalc: { passed: true, detail: '红线备注已补录，检测到冲突并生成记录' },
      exportConsistent: { passed: true, detail: '导出数据与系统一致' },
      overallConclusion: '施工改道未同步，待复核；重复导入已去重；公交与红线有冲突需确认。',
    },
    createdAt: '2026-06-05T10:00:00.000Z',
  },
];
    importCount: 1,
    lastImportSource: '公交公司数据批次2026-06-A',
    lastImportBatchId: batchA,
    importBatches: [
      {
        batchId: batchA,
        source: '公交公司数据批次2026-06-A',
        importedAt: '2026-06-03T11:00:00.000Z',
        busCardTime: '7:15-8:00, 15:45-17:00',
        isDuplicate: false,
        importOrder: 1,
      },
    ],
    createdAt: '2026-06-02T11:00:00.000Z',
    updatedAt: '2026-06-05T09:00:00.000Z',
  },
  {
    id: 'p4',
    name: '向阳中学北门点位',
    location: '向阳中学北门东侧',
    busCardTime: '6:45-7:45, 16:30-18:00',
    redLineNote: '早高峰禁止设摊，仅限中午11:30-12:30',
    status: 'conflict',
    hasConstructionDetour: false,
    mapSynced: true,
    reviewStatus: 'not-needed',
    importCount: 1,
    lastImportSource: '公交公司数据批次2026-06-A',
    lastImportBatchId: batchA,
    importBatches: [
      {
        batchId: batchA,
        source: '公交公司数据批次2026-06-A',
        importedAt: '2026-06-04T14:00:00.000Z',
        busCardTime: '6:45-7:45, 16:30-18:00',
        isDuplicate: false,
        importOrder: 1,
      },
    ],
    createdAt: '2026-06-02T14:00:00.000Z',
    updatedAt: '2026-06-04T16:45:00.000Z',
  },
  {
    id: 'p5',
    name: '光明小学正门点位',
    location: '光明小学正门口',
    busCardTime: '7:00-8:00, 16:00-17:30',
    redLineNote: '',
    status: 'pending',
    hasConstructionDetour: true,
    mapSynced: false,
    reviewStatus: 'pending',
    importCount: 1,
    lastImportSource: '公交公司数据批次2026-06-B',
    lastImportBatchId: batchB,
    importBatches: p5Batches,
    createdAt: '2026-06-03T08:30:00.000Z',
    updatedAt: '2026-06-06T11:20:00.000Z',
  },
];

export const mockConflicts: Conflict[] = [
  {
    id: 'c1',
    pointId: 'p1',
    pointName: '实验小学东门点位',
    type: 'bus-vs-redline',
    busCardValue: '7:00-8:30, 16:00-18:00',
    redLineValue: '早7:30-8:30禁止摆摊，下午16:30后可设摊',
    evidence: '公交刷卡显示早7:00-8:30有大量人流，但红线图备注7:30-8:30禁止摆摊，两者存在矛盾。下午公交16:00开始有人流，但红线图要求16:30后才可设摊，也有30分钟差异。',
    source: '三步流程第2步自动检测',
    status: 'pending',
    createdAt: '2026-06-05T14:35:00.000Z',
  },
  {
    id: 'c2',
    pointId: 'p4',
    pointName: '向阳中学北门点位',
    type: 'bus-vs-redline',
    busCardValue: '6:45-7:45, 16:30-18:00',
    redLineValue: '早高峰禁止设摊，仅限中午11:30-12:30',
    evidence: '公交数据显示早晚高峰人流集中，但红线图完全禁止早晚高峰设摊，只允许中午时段，两者差异较大。',
    source: '三步流程第2步自动检测',
    status: 'pending',
    createdAt: '2026-06-04T16:50:00.000Z',
  },
  {
    id: 'c3',
    pointId: 'p1',
    pointName: '实验小学东门点位',
    type: 'detour-not-synced',
    busCardValue: '',
    redLineValue: '',
    evidence: '该点位存在施工临时改道（东门北侧道路封闭，需绕行至南侧入口，约50米绕行距离），但地图数据尚未同步更新，可能导致导览错误。',
    source: '施工改道上报系统（施工队2026-06-05上报）',
    status: 'pending',
    createdAt: '2026-06-05T10:00:00.000Z',
  },
  {
    id: 'c4',
    pointId: 'p5',
    pointName: '光明小学正门点位',
    type: 'detour-not-synced',
    busCardValue: '',
    redLineValue: '',
    evidence: '该点位存在施工临时改道（正门前方地铁施工，行人需从东侧侧门绕行，约80米绕行距离），但地图数据尚未同步更新，可能导致导览错误。',
    source: '施工改道上报系统（地铁项目部2026-06-06上报）',
    status: 'pending',
    createdAt: '2026-06-06T08:00:00.000Z',
  },
  {
    id: 'c5',
    pointId: 'p1',
    pointName: '实验小学东门点位',
    type: 'duplicate-import',
    busCardValue: '7:00-8:30, 16:00-18:00',
    redLineValue: '',
    evidence: '同一来源批次（batch-2026-06-A，公交公司数据批次2026-06-A）的公交刷卡数据被导入了2次。第1次导入：2026-06-05 10:00，第2次重传：2026-06-05 14:30。数据内容完全一致。',
    source: '三步流程第1步重复导入检测',
    batchId: batchA,
    batchSource: '公交公司数据批次2026-06-A',
    importOrder: 2,
    totalDuplicates: 2,
    conclusion: '系统判定为同一批次重传，已自动去重处理。点位导入次数累计为2次，但实际数据仅保留1份，未产生翻倍。',
    status: 'resolved',
    handler: '系统自动处理',
    handledAt: '2026-06-05T14:30:00.000Z',
    createdAt: '2026-06-05T14:30:00.000Z',
  },
];

export const mockHistory: HistoryRecord[] = [
  {
    id: 'h1',
    pointId: 'p1',
    pointName: '实验小学东门点位',
    action: 'import',
    operator: '老马',
    beforeData: { busCardTime: '', importCount: 0 },
    afterData: { busCardTime: '7:00-8:30, 16:00-18:00', importCount: 1 },
    fieldChanges: [
      {
        field: 'busCardTime',
        fieldLabel: '公交刷卡时段',
        beforeValue: '（空）',
        afterValue: '7:00-8:30, 16:00-18:00',
      },
      {
        field: 'importCount',
        fieldLabel: '导入次数',
        beforeValue: '0',
        afterValue: '1',
      },
    ],
    changeReason: '首次导入公交公司2026-06-A批次（batch-2026-06-A）数据',
    remark: '第一步：导入公交刷卡时段（第1次，新批次）',
    createdAt: '2026-06-05T10:00:00.000Z',
  },
  {
    id: 'h2',
    pointId: 'p1',
    pointName: '实验小学东门点位',
    action: 'import',
    operator: '老马',
    beforeData: { busCardTime: '7:00-8:30, 16:00-18:00', importCount: 1, lastImportSource: '公交公司数据批次2026-06-A' },
    afterData: { busCardTime: '7:00-8:30, 16:00-18:00', importCount: 2, lastImportSource: '公交公司数据批次2026-06-A' },
    fieldChanges: [
      {
        field: 'busCardTime',
        fieldLabel: '公交刷卡时段',
        beforeValue: '7:00-8:30, 16:00-18:00',
        afterValue: '7:00-8:30, 16:00-18:00（无变化，已去重）',
      },
      {
        field: 'importCount',
        fieldLabel: '导入次数',
        beforeValue: '1',
        afterValue: '2',
      },
    ],
    changeReason: '同一批次（batch-2026-06-A）重传，系统自动去重，仅累计导入次数，数据未翻倍',
    remark: '第一步：导入公交刷卡时段（第2次，同一批次重传，已去重）',
    createdAt: '2026-06-05T14:30:00.000Z',
  },
  {
    id: 'h3',
    pointId: 'p1',
    pointName: '实验小学东门点位',
    action: 'supplement',
    operator: '老马',
    beforeData: { redLineNote: '', status: 'pending' },
    afterData: { redLineNote: '早7:30-8:30禁止摆摊，下午16:30后可设摊', status: 'conflict' },
    fieldChanges: [
      {
        field: 'redLineNote',
        fieldLabel: '红线图备注',
        beforeValue: '（空）',
        afterValue: '早7:30-8:30禁止摆摊，下午16:30后可设摊',
      },
      {
        field: 'status',
        fieldLabel: '点位状态',
        beforeValue: '待处理',
        afterValue: '有冲突',
      },
    ],
    changeReason: '对照红线图补录备注，自动检测到与公交时段存在时间冲突',
    remark: '第二步：补看红线图备注（检测到时段冲突）',
    createdAt: '2026-06-05T14:35:00.000Z',
  },
  {
    id: 'h4',
    pointId: 'p1',
    pointName: '实验小学东门点位',
    action: 'update',
    operator: '老马',
    beforeData: { status: 'conflict', reviewStatus: 'pending' },
    afterData: { status: 'pending-review', reviewStatus: 'pending' },
    fieldChanges: [
      {
        field: 'status',
        fieldLabel: '点位状态',
        beforeValue: '有冲突',
        afterValue: '待复核',
      },
      {
        field: 'reviewStatus',
        fieldLabel: '复核状态',
        beforeValue: '待复核',
        afterValue: '待复核',
      },
    ],
    changeReason: '完成三步流程处理，发现施工临时改道未同步地图，转交居民代表复核，不归入正常',
    remark: '第三步：更新点位清单（施工改道未同步，待居民代表复核）',
    createdAt: '2026-06-05T15:00:00.000Z',
  },
  {
    id: 'h5',
    pointId: 'p3',
    pointName: '育才小学西门点位',
    action: 'supplement',
    operator: '老马',
    beforeData: { redLineNote: '', status: 'pending' },
    afterData: { redLineNote: '早7:00-8:00、下午15:30-17:00可设摊', status: 'pending-review' },
    fieldChanges: [
      {
        field: 'redLineNote',
        fieldLabel: '红线图备注',
        beforeValue: '（空）',
        afterValue: '早7:00-8:00、下午15:30-17:00可设摊',
      },
      {
        field: 'status',
        fieldLabel: '点位状态',
        beforeValue: '待处理',
        afterValue: '待复核',
      },
    ],
    changeReason: '对照最新红线图补全备注信息，施工改道待居民代表复核',
    remark: '第二步：补看红线图后更新备注',
    createdAt: '2026-06-05T09:00:00.000Z',
  },
  {
    id: 'h6',
    pointId: 'p3',
    pointName: '育才小学西门点位',
    action: 'review',
    operator: '居民代表王阿姨',
    beforeData: { reviewStatus: 'pending', mapSynced: false, status: 'pending-review' },
    afterData: { reviewStatus: 'approved', mapSynced: true, status: 'normal' },
    fieldChanges: [
      {
        field: 'reviewStatus',
        fieldLabel: '复核状态',
        beforeValue: '待复核',
        afterValue: '已通过',
      },
      {
        field: 'mapSynced',
        fieldLabel: '地图同步',
        beforeValue: '未同步',
        afterValue: '已同步',
      },
      {
        field: 'status',
        fieldLabel: '点位状态',
        beforeValue: '待复核',
        afterValue: '正常',
      },
    ],
    changeReason: '现场核实施工改道已完成，地图数据已更新同步，点位归为正常',
    remark: '施工改道复核通过，地图已同步，点位归正常',
    createdAt: '2026-06-05T10:30:00.000Z',
  },
  {
    id: 'h7',
    pointId: 'p2',
    pointName: '第一中学南门点位',
    action: 'create',
    operator: '业务小李',
    beforeData: {},
    afterData: { name: '第一中学南门点位', location: '第一中学南门对面人行道' },
    fieldChanges: [],
    changeReason: '新增点位基础信息',
    remark: '新增点位',
    createdAt: '2026-06-01T09:00:00.000Z',
  },
  {
    id: 'h8',
    pointId: 'p4',
    pointName: '向阳中学北门点位',
    action: 'import',
    operator: '老马',
    beforeData: { busCardTime: '', importCount: 0 },
    afterData: { busCardTime: '6:45-7:45, 16:30-18:00', importCount: 1 },
    fieldChanges: [
      {
        field: 'busCardTime',
        fieldLabel: '公交刷卡时段',
        beforeValue: '（空）',
        afterValue: '6:45-7:45, 16:30-18:00',
      },
      {
        field: 'importCount',
        fieldLabel: '导入次数',
        beforeValue: '0',
        afterValue: '1',
      },
    ],
    changeReason: '首次导入公交公司2026-06-A批次（batch-2026-06-A）数据',
    remark: '第一步：导入公交刷卡时段数据',
    createdAt: '2026-06-04T16:45:00.000Z',
  },
  {
    id: 'h9',
    pointId: 'p5',
    pointName: '光明小学正门点位',
    action: 'import',
    operator: '老马',
    beforeData: { busCardTime: '', importCount: 0 },
    afterData: { busCardTime: '7:00-8:00, 16:00-17:30', importCount: 1 },
    fieldChanges: [
      {
        field: 'busCardTime',
        fieldLabel: '公交刷卡时段',
        beforeValue: '（空）',
        afterValue: '7:00-8:00, 16:00-17:30',
      },
      {
        field: 'importCount',
        fieldLabel: '导入次数',
        beforeValue: '0',
        afterValue: '1',
      },
    ],
    changeReason: '首次导入公交公司2026-06-B批次（batch-2026-06-B）数据',
    remark: '第一步：导入公交刷卡时段（新批次）',
    createdAt: '2026-06-06T08:00:00.000Z',
  },
];

export const mockSelfCheckResults: SelfCheckResult[] = [
  {
    id: 's1',
    reportName: '2026年6月第1次全面自检报告',
    overallStatus: 'error',
    summary: '检测发现2处施工改道未同步地图，1处重复导入记录（同一批次重传已去重），其余项目正常。',
    items: [
      {
        type: 'duplicate-import',
        typeName: '重复导入检测',
        source: '三步流程导入记录比对（去重口径：相同点位+相同数据内容+同一来源批次ID）',
        status: 'warning',
        issues: [
          '实验小学东门点位：同一批次 batch-2026-06-A 被导入2次（第1次2026-06-05 10:00，第2次2026-06-05 14:30重传），系统已自动去重',
        ],
        conclusion: '发现1处同一批次重复导入，系统均已自动去重处理，数据未产生翻倍。不同来源批次的数据不会被误拦。',
      },
      {
        type: 'detour-sync',
        typeName: '施工改道同步检查',
        source: '施工改道上报系统 与 地图数据 交叉比对（来源：施工队/地铁项目部上报）',
        status: 'error',
        issues: [
          '实验小学东门点位：有施工改道（东门北侧道路封闭）但地图未同步，来源：施工队2026-06-05上报',
          '光明小学正门点位：有施工改道（正门前方地铁施工）但地图未同步，来源：地铁项目部2026-06-06上报',
        ],
        conclusion: '发现2处施工改道未同步地图，已标记为待居民代表复核，不归入正常状态。复核通过后自动同步地图并归为正常。',
      },
      {
        type: 'recalculate',
        typeName: '补录后重算',
        source: '补录记录与统计数据自动比对（红线图备注补录后自动触发统计重算）',
        status: 'warning',
        issues: [
          '光明小学正门点位：红线图备注尚未补录',
        ],
        conclusion: '1处红线图备注待补录，补录后相关统计数据将自动重算，确保数据一致性。其余补录数据均已触发重算。',
      },
      {
        type: 'export-consistent',
        typeName: '导出一致性校验',
        source: '导出模板与系统内部数据字段逐项比对（含点位状态、批次信息、复核状态）',
        status: 'pass',
        issues: [],
        conclusion: '导出数据与系统内部数据完全一致，包含点位状态、来源批次、导入次数、复核状态等全部字段。',
      },
    ],
    checkedAt: now,
    operator: '老马',
  },
];

export const mockWorkflows: Workflow[] = [
  {
    id: 'w1',
    pointId: 'p5',
    pointName: '光明小学正门点位',
    currentStep: 1,
    status: 'in-progress',
    stepData: {
      step1: {
        busCardTime: '7:00-8:00, 16:00-17:30',
        importedAt: '2026-06-06T08:00:00.000Z',
        importSource: '公交公司数据批次2026-06-B',
        isDuplicate: false,
        duplicateDetected: false,
      },
    },
    createdAt: '2026-06-06T11:20:00.000Z',
  },
  {
    id: 'w2',
    pointId: 'p1',
    pointName: '实验小学东门点位',
    currentStep: 3,
    status: 'pending-review',
    stepData: {
      step1: {
        busCardTime: '7:00-8:30, 16:00-18:00',
        importedAt: '2026-06-05T14:30:00.000Z',
        importSource: '公交公司数据批次2026-06-A',
        isDuplicate: true,
        duplicateDetected: true,
      },
      step2: {
        redLineNote: '早7:30-8:30禁止摆摊，下午16:30后可设摊',
        reviewedAt: '2026-06-05T14:35:00.000Z',
        reviewer: '老马',
        hasConflict: true,
        conflictDescription: '公交刷卡显示早高峰人流集中，但红线图备注早高峰部分时段禁止摆摊，两者存在矛盾。',
      },
      step3: {
        updatedAt: '2026-06-05T15:00:00.000Z',
        operator: '老马',
        pointStatus: 'pending-review',
        reviewStatus: 'pending',
      },
    },
    finalReport: {
      duplicateCheck: {
        passed: false,
        detail: '检测到同一批次（batch-2026-06-A）重复导入2次，系统已自动去重，数据未翻倍。来源：公交公司数据批次2026-06-A，重传次数：2次。',
      },
      detourSync: {
        passed: false,
        detail: '存在施工临时改道但地图未同步（东门北侧道路封闭，施工队2026-06-05上报），需居民代表复核，暂不归入正常。',
      },
      supplementRecalc: {
        passed: true,
        detail: '红线图备注已补录，检测到与公交时段存在冲突，已自动生成冲突记录，相关统计已重算。',
      },
      exportConsistent: {
        passed: true,
        detail: '导出数据与系统内部数据一致，包含完整批次信息、状态、复核记录。',
      },
      overallConclusion: '存在施工临时改道未同步地图，已转交居民代表复核，暂不归为正常；重复导入已自动去重，数据未翻倍；公交时段与红线图备注存在冲突，需后续确认处理。',
    },
    createdAt: '2026-06-05T10:00:00.000Z',
  },
];
