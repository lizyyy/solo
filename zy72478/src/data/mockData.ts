
import type {
  Project,
  BusSwipeRecord,
  RedlineNote,
  HeatmapData,
  ConflictRecord,
  SelfCheckResult,
  OperationLog,
  TodoItem,
} from '../../shared/types';

export const mockProjects: Project[] = [
  {
    id: 'proj-001',
    name: '城西区老旧小区改造项目',
    status: 'processing',
    createdAt: '2026-05-15',
  },
  {
    id: 'proj-002',
    name: '东大街片区城市更新项目',
    status: 'reviewing',
    createdAt: '2026-05-20',
  },
  {
    id: 'proj-003',
    name: '南滨河路棚户区改造',
    status: 'pending',
    createdAt: '2026-06-01',
  },
];

export const mockBusSwipes: BusSwipeRecord[] = [
  {
    id: 'bus-001',
    projectId: 'proj-001',
    cardId: 'CARD001',
    swipeTime: '2026-06-05 07:30:00',
    route: '101路',
    location: '城西小区站',
    source: 'normal',
  },
  {
    id: 'bus-002',
    projectId: 'proj-001',
    cardId: 'CARD002',
    swipeTime: '2026-06-05 08:15:00',
    route: '101路',
    location: '城西小区站',
    source: 'normal',
  },
  {
    id: 'bus-003',
    projectId: 'proj-001',
    cardId: 'CARD003',
    swipeTime: '2026-06-05 23:45:00',
    route: '夜1路',
    location: '城西小区站',
    source: 'normal',
  },
  {
    id: 'bus-004',
    projectId: 'proj-001',
    cardId: 'CARD001',
    swipeTime: '2026-06-05 18:20:00',
    route: '101路',
    location: '人民广场站',
    source: 'normal',
  },
  {
    id: 'bus-005',
    projectId: 'proj-001',
    cardId: 'CARD004',
    swipeTime: '2026-06-05 09:00:00',
    route: '203路',
    location: '拆迁区东站',
    source: 'wrong',
  },
  {
    id: 'bus-006',
    projectId: 'proj-001',
    cardId: 'CARD002',
    swipeTime: '2026-06-05 08:15:00',
    route: '101路',
    location: '城西小区站',
    source: 'normal',
    isDuplicate: true,
  },
  {
    id: 'bus-007',
    projectId: 'proj-001',
    cardId: 'CARD005',
    swipeTime: '2026-06-06 06:30:00',
    route: '101路',
    location: '城西小区站',
    source: 'supplement',
  },
];

export const mockRedlineNotes: RedlineNote[] = [
  {
    id: 'red-001',
    projectId: 'proj-001',
    areaName: '城西小区A区',
    remark: '该区域已于2026年5月完成拆迁，无居民居住',
    boundaryCoords: '116.40,39.90;116.41,39.90;116.41,39.91;116.40,39.91',
    recordDate: '2026-05-10',
    source: 'normal',
  },
  {
    id: 'red-002',
    projectId: 'proj-001',
    areaName: '拆迁区东片',
    remark: '该区域计划2026年6月启动拆迁，目前仍有居民',
    boundaryCoords: '116.42,39.88;116.43,39.88;116.43,39.89;116.42,39.89',
    recordDate: '2026-05-15',
    source: 'normal',
  },
  {
    id: 'red-003',
    projectId: 'proj-001',
    areaName: '城西小区B区',
    remark: '该区域尚有部分居民未搬迁',
    boundaryCoords: '116.40,39.91;116.41,39.91;116.41,39.92;116.40,39.92',
    recordDate: '2026-06-01',
    source: 'supplement',
  },
];

const generateHeatmapPoints = (): HeatmapData['data'] => {
  const points: HeatmapData['data'] = [];
  const areas = [
    { name: '城西小区A区', baseX: 200, baseY: 200 },
    { name: '城西小区B区', baseX: 350, baseY: 200 },
    { name: '拆迁区东片', baseX: 500, baseY: 350 },
    { name: '人民广场', baseX: 300, baseY: 400 },
  ];

  areas.forEach((area) => {
    for (let i = 0; i < 15; i++) {
      const hour = Math.floor(Math.random() * 24);
      const isNight = hour >= 22 || hour < 6;
      const value = isNight
        ? Math.floor(Math.random() * 30) + 10
        : Math.floor(Math.random() * 80) + 40;
      points.push({
        x: area.baseX + (Math.random() - 0.5) * 100,
        y: area.baseY + (Math.random() - 0.5) * 100,
        value,
        time: `2026-06-05 ${hour.toString().padStart(2, '0')}:${Math.floor(Math.random() * 60).toString().padStart(2, '0')}:00`,
        areaName: area.name,
      });
    }
  });
  return points;
};

export const mockHeatmapData: HeatmapData[] = [
  {
    id: 'heat-001',
    projectId: 'proj-001',
    version: 'v1.0',
    data: generateHeatmapPoints(),
    hasLowSampling: true,
    lowSamplingAreas: ['城西小区A区'],
    status: 'pending_review',
    createdAt: '2026-06-05 10:00:00',
  },
  {
    id: 'heat-002',
    projectId: 'proj-001',
    version: 'v1.1',
    data: generateHeatmapPoints(),
    hasLowSampling: false,
    status: 'confirmed',
    createdAt: '2026-06-06 14:30:00',
  },
];

export const mockConflicts: ConflictRecord[] = [
  {
    id: 'conf-001',
    projectId: 'proj-001',
    busSwipeId: 'bus-005',
    redlineNoteId: 'red-002',
    description: '公交刷卡记录与红线图备注存在时间矛盾',
    evidence: {
      busSwipe: mockBusSwipes[4],
      redlineNote: mockRedlineNotes[1],
      contradiction:
        '红线图备注显示拆迁区东片计划2026年6月启动拆迁，目前仍有居民；但公交刷卡记录显示该区域早高峰时段刷卡量异常偏低，与"仍有居民"不符。',
    },
    status: 'pending',
  },
  {
    id: 'conf-002',
    projectId: 'proj-001',
    busSwipeId: 'bus-003',
    redlineNoteId: 'red-001',
    description: '夜间刷卡记录与已拆迁区域矛盾',
    evidence: {
      busSwipe: mockBusSwipes[2],
      redlineNote: mockRedlineNotes[0],
      contradiction:
        '红线图备注显示城西小区A区已于2026年5月完成拆迁，无居民居住；但存在23:45的夜间刷卡记录，可能数据有误或有遗漏住户。',
    },
    status: 'pending',
  },
];

export const mockSelfChecks: SelfCheckResult[] = [
  {
    type: 'duplicate',
    name: '重复导入检测',
    status: 'warning',
    message: '检测到2条重复导入记录，可能影响数据准确性',
    details: { duplicateCount: 2, records: ['bus-002', 'bus-006'] },
  },
  {
    type: 'low_sampling',
    name: '夜间采样不足检测',
    status: 'error',
    message: '城西小区A区夜间(22:00-06:00)采样量仅为日间的25%，热力图可能偏低',
    details: { areas: ['城西小区A区'], samplingRatio: 0.25 },
  },
  {
    type: 'recalculation',
    name: '补录后重算验证',
    status: 'pass',
    message: '补录数据后热力图重算正常，版本已更新至v1.1',
  },
  {
    type: 'export_consistency',
    name: '导出一致性校验',
    status: 'pass',
    message: '导出数据与系统数据一致，共128条记录无误',
  },
];

export const mockOperationLogs: OperationLog[] = [
  {
    id: 'log-001',
    projectId: 'proj-001',
    action: '导入公交刷卡数据',
    operator: '社区书记-周姐',
    details: '导入正常口径公交刷卡数据156条',
    createdAt: '2026-06-05 09:30:00',
  },
  {
    id: 'log-002',
    projectId: 'proj-001',
    action: '生成热力图v1.0',
    operator: '系统',
    details: '基于公交刷卡数据生成初步热力图',
    createdAt: '2026-06-05 10:00:00',
  },
  {
    id: 'log-003',
    projectId: 'proj-001',
    action: '录入红线图备注',
    operator: '社区书记-周姐',
    details: '补录3条红线图区域备注信息',
    createdAt: '2026-06-05 11:20:00',
  },
  {
    id: 'log-004',
    projectId: 'proj-001',
    action: '检测到数据冲突',
    operator: '系统',
    details: '自动检测到2条公交刷卡与红线图矛盾记录',
    createdAt: '2026-06-05 11:25:00',
  },
  {
    id: 'log-005',
    projectId: 'proj-001',
    action: '导入补录数据',
    operator: '街道规划员-小李',
    details: '导入补录公交刷卡数据23条',
    createdAt: '2026-06-06 14:00:00',
  },
  {
    id: 'log-006',
    projectId: 'proj-001',
    action: '热力图重算',
    operator: '系统',
    details: '补录数据后自动重算热力图，更新至v1.1',
    createdAt: '2026-06-06 14:30:00',
  },
];

export const mockTodos: TodoItem[] = [
  {
    id: 'todo-001',
    title: '处理2条数据冲突',
    description: '公交刷卡时段与红线图备注存在矛盾，需周姐确认或驳回',
    priority: 'high',
    status: 'pending',
    relatedPage: '/conflicts',
  },
  {
    id: 'todo-002',
    title: '复核城西小区A区热力图',
    description: '该区域夜间采样不足导致热力图偏低，需规划员复核',
    priority: 'high',
    status: 'pending',
    relatedPage: '/heatmap',
  },
  {
    id: 'todo-003',
    title: '处理重复导入记录',
    description: '检测到2条重复记录，建议去重后重新导入',
    priority: 'medium',
    status: 'pending',
    relatedPage: '/self-check',
  },
  {
    id: 'todo-004',
    title: '导出城西区项目最终报告',
    description: '所有数据确认无误后导出安置报告',
    priority: 'low',
    status: 'pending',
    relatedPage: '/history',
  },
];
