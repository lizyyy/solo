
import type {
  Project,
  BusSwipeRecord,
  RedlineNote,
  HeatmapData,
  ConflictRecord,
  SelfCheckResult,
  OperationLog,
  TodoItem,
  HeatmapPoint,
  AreaHeatmapStats,
} from '../../shared/types';

export const AREA_COORDINATE_MAP: Record<string, { baseX: number; baseY: number }> = {
  '城西小区A区': { baseX: 200, baseY: 200 },
  '城西小区B区': { baseX: 350, baseY: 200 },
  '拆迁区东片': { baseX: 500, baseY: 350 },
  '人民广场': { baseX: 300, baseY: 400 },
  '南滨河路': { baseX: 450, baseY: 150 },
};

export const LOCATION_TO_AREA: Record<string, string> = {
  '城西小区站': '城西小区A区',
  '人民广场站': '人民广场',
  '拆迁区东站': '拆迁区东片',
  '南滨河路站': '南滨河路',
};

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

function enrichBusRecord(record: Omit<BusSwipeRecord, 'areaName' | 'hourOfDay' | 'isNight'>): BusSwipeRecord {
  const hour = parseInt(record.swipeTime.split(' ')[1]?.split(':')[0] || '0', 10);
  return {
    ...record,
    areaName: LOCATION_TO_AREA[record.location] || '未知区域',
    hourOfDay: hour,
    isNight: hour >= 22 || hour < 6,
  };
}

export const mockBusSwipes: BusSwipeRecord[] = [
  enrichBusRecord({
    id: 'bus-001',
    projectId: 'proj-001',
    cardId: 'CARD001',
    swipeTime: '2026-06-05 07:30:00',
    route: '101路',
    location: '城西小区站',
    source: 'normal',
  }),
  enrichBusRecord({
    id: 'bus-002',
    projectId: 'proj-001',
    cardId: 'CARD002',
    swipeTime: '2026-06-05 08:15:00',
    route: '101路',
    location: '城西小区站',
    source: 'normal',
  }),
  enrichBusRecord({
    id: 'bus-003',
    projectId: 'proj-001',
    cardId: 'CARD003',
    swipeTime: '2026-06-05 23:45:00',
    route: '夜1路',
    location: '城西小区站',
    source: 'normal',
  }),
  enrichBusRecord({
    id: 'bus-004',
    projectId: 'proj-001',
    cardId: 'CARD001',
    swipeTime: '2026-06-05 18:20:00',
    route: '101路',
    location: '人民广场站',
    source: 'normal',
  }),
  enrichBusRecord({
    id: 'bus-005',
    projectId: 'proj-001',
    cardId: 'CARD004',
    swipeTime: '2026-06-05 09:00:00',
    route: '203路',
    location: '拆迁区东站',
    source: 'wrong',
  }),
  enrichBusRecord({
    id: 'bus-006',
    projectId: 'proj-001',
    cardId: 'CARD002',
    swipeTime: '2026-06-05 08:15:00',
    route: '101路',
    location: '城西小区站',
    source: 'normal',
    isDuplicate: true,
  }),
  enrichBusRecord({
    id: 'bus-007',
    projectId: 'proj-001',
    cardId: 'CARD005',
    swipeTime: '2026-06-06 06:30:00',
    route: '101路',
    location: '城西小区站',
    source: 'supplement',
  }),
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
    remark: '该区域计划2026年6月启动拆迁，目前仍有居民居住',
    boundaryCoords: '116.42,39.88;116.43,39.88;116.43,39.89;116.42,39.89',
    recordDate: '2026-05-15',
    source: 'normal',
  },
  {
    id: 'red-003',
    projectId: 'proj-001',
    areaName: '城西小区B区',
    remark: '该区域尚有部分居民未搬迁，预计6月底完成',
    boundaryCoords: '116.40,39.91;116.41,39.91;116.41,39.92;116.40,39.92',
    recordDate: '2026-06-01',
    source: 'supplement',
  },
];

export function calculateHeatValue(hour: number, isNight: boolean, areaName: string): number {
  const rushHours = [7, 8, 9, 17, 18, 19];
  const isRush = rushHours.includes(hour);
  let baseValue = isRush ? 85 : isNight ? 15 : 50;
  if (areaName === '拆迁区东片') baseValue *= 0.7;
  if (areaName === '南滨河路') baseValue *= 0.85;
  return Math.min(100, Math.max(5, baseValue + Math.floor(Math.random() * 10) - 5));
}

export function generateHeatmapPointsFromBusSwipes(
  busSwipes: BusSwipeRecord[],
  busSwipeOffsetIds: string[] = []
): {
  points: HeatmapPoint[];
  areaStats: AreaHeatmapStats[];
  sourceIds: string[];
} {
  const points: HeatmapPoint[] = [];
  const sourceIds: string[] = [];
  const areaMap = new Map<string, { day: number; night: number; values: number[] }>();

  const effectiveSwipes = busSwipeOffsetIds.length > 0
    ? busSwipes.filter((b) => busSwipeOffsetIds.includes(b.id))
    : busSwipes;

  effectiveSwipes.forEach((bus) => {
    const coord = AREA_COORDINATE_MAP[bus.areaName] || { baseX: 300, baseY: 300 };
    const value = calculateHeatValue(bus.hourOfDay!, bus.isNight!, bus.areaName);
    const jitterX = (Math.random() - 0.5) * 60;
    const jitterY = (Math.random() - 0.5) * 60;

    points.push({
      x: coord.baseX + jitterX,
      y: coord.baseY + jitterY,
      value,
      time: bus.swipeTime,
      areaName: bus.areaName,
      busSwipeId: bus.id,
      cardId: bus.cardId,
      hourOfDay: bus.hourOfDay!,
      isNight: bus.isNight!,
      source: bus.source,
    });
    sourceIds.push(bus.id);

    if (!areaMap.has(bus.areaName)) {
      areaMap.set(bus.areaName, { day: 0, night: 0, values: [] });
    }
    const stats = areaMap.get(bus.areaName)!;
    if (bus.isNight) stats.night++; else stats.day++;
    stats.values.push(value);
  });

  const areaStats: AreaHeatmapStats[] = Array.from(areaMap.entries()).map(([areaName, s]) => {
    const total = s.day + s.night;
    const avg = total > 0 ? s.values.reduce((a, b) => a + b, 0) / total : 0;
    const max = total > 0 ? Math.max(...s.values) : 0;
    const nightRatio = total > 0 ? s.night / total : 0;
    const hasLowSampling = s.night > 0 && s.night < s.day * 0.3;
    return {
      areaName,
      totalRecords: total,
      dayRecords: s.day,
      nightRecords: s.night,
      avgValue: Math.round(avg * 10) / 10,
      maxValue: max,
      hasLowSampling,
    };
  });

  return { points, areaStats, sourceIds };
}

function createMockHeatmapData(): HeatmapData[] {
  const firstGen = generateHeatmapPointsFromBusSwipes(
    mockBusSwipes.filter((b) => b.source === 'normal' || b.source === 'wrong')
  );
  const v1Stats = firstGen.areaStats;
  const v1LowAreas = v1Stats.filter((s) => s.hasLowSampling).map((s) => s.areaName);

  const allGen = generateHeatmapPointsFromBusSwipes(mockBusSwipes);
  const v2Stats = allGen.areaStats;
  const v2LowAreas = v2Stats.filter((s) => s.hasLowSampling).map((s) => s.areaName);

  return [
    {
      id: 'heat-001',
      projectId: 'proj-001',
      version: 'v1.0',
      data: firstGen.points,
      points: firstGen.points,
      areaStats: v1Stats,
      sourceBusSwipeIds: firstGen.sourceIds,
      sourceBusCount: firstGen.sourceIds.length,
      hasLowSampling: v1LowAreas.length > 0,
      lowSamplingAreas: v1LowAreas.length > 0 ? v1LowAreas : undefined,
      status: 'pending_review',
      createdAt: '2026-06-05 10:00:00',
      calculatedAt: '2026-06-05 10:00:00',
    },
    {
      id: 'heat-002',
      projectId: 'proj-001',
      version: 'v1.1',
      data: allGen.points,
      points: allGen.points,
      areaStats: v2Stats,
      sourceBusSwipeIds: allGen.sourceIds,
      sourceBusCount: allGen.sourceIds.length,
      hasLowSampling: v2LowAreas.length > 0,
      lowSamplingAreas: v2LowAreas.length > 0 ? v2LowAreas : undefined,
      status: 'confirmed',
      createdAt: '2026-06-06 14:30:00',
      calculatedAt: '2026-06-06 14:30:00',
    },
  ];
}

export const mockHeatmapData: HeatmapData[] = createMockHeatmapData();

export const mockConflicts: ConflictRecord[] = [
  {
    id: 'conf-001',
    projectId: 'proj-001',
    busSwipeId: 'bus-005',
    redlineNoteId: 'red-002',
    description: '公交数据与"拆迁区东片"红线图备注存在矛盾',
    evidence: {
      busSwipe: mockBusSwipes[4],
      redlineNote: mockRedlineNotes[1],
      contradiction:
        '红线图备注说明"拆迁区东片"计划2026年6月启动拆迁仍有居民，但公交刷卡记录显示早高峰时段(09:00)仅1条记录，数据异常偏低；另外刷卡日期早于红线图记录日期，口径可能不一致。',
    },
    status: 'pending',
  },
  {
    id: 'conf-002',
    projectId: 'proj-001',
    busSwipeId: 'bus-003',
    redlineNoteId: 'red-001',
    description: '公交数据与"城西小区A区"红线图备注存在矛盾',
    evidence: {
      busSwipe: mockBusSwipes[2],
      redlineNote: mockRedlineNotes[0],
      contradiction:
        '红线图备注说明"城西小区A区"已于2026年5月完成拆迁无居民，但公交刷卡记录显示卡号CARD003于23:45夜间在城西小区站刷卡，可能有遗漏住户或数据错误。',
    },
    status: 'pending',
  },
];

export const mockSelfChecks: SelfCheckResult[] = [
  {
    type: 'duplicate',
    name: '重复导入检测',
    status: 'warning',
    message: '检测到1条重复导入记录（CARD002 2026-06-05 08:15:00 城西小区站），可能导致热力图数据重复统计，建议去重后重新导入',
    details: { duplicateCount: 1, records: ['bus-006'] },
    lastRunAt: new Date().toISOString(),
  },
  {
    type: 'low_sampling',
    name: '夜间采样不足检测',
    status: 'error',
    message: '城西小区A区等区域夜间(22:00-06:00)采样量低于日间30%，热力图颜色偏淡，留给街道规划员复核后再确认',
    details: { areas: ['城西小区A区', '拆迁区东片'], samplingRatio: 0.25 },
    lastRunAt: new Date().toISOString(),
  },
  {
    type: 'recalculation',
    name: '补录后重算验证',
    status: 'pass',
    message: '补录数据导入后热力图已自动重算，当前共2个版本可追溯，v1.1包含补录数据bus-007',
    lastRunAt: new Date().toISOString(),
  },
  {
    type: 'export_consistency',
    name: '导出一致性校验',
    status: 'pass',
    message: '导出数据与系统内部数据一致，共7条公交记录、60个热力点核对无误，所有热力点均可追溯到原始刷卡记录',
    lastRunAt: new Date().toISOString(),
  },
];

export const mockOperationLogs: OperationLog[] = [
  {
    id: 'log-001',
    projectId: 'proj-001',
    action: '导入公交刷卡数据',
    operator: '社区书记-周姐',
    details: '导入正常口径公交刷卡数据6条（CARD001-CARD004、重复1条）',
    createdAt: '2026-06-05 09:30:00',
  },
  {
    id: 'log-002',
    projectId: 'proj-001',
    action: '热力图重算',
    operator: '系统',
    details: '基于6条公交刷卡数据生成热力图v1.0，6个热力点，已关联每条刷卡ID',
    createdAt: '2026-06-05 10:00:00',
  },
  {
    id: 'log-003',
    projectId: 'proj-001',
    action: '录入红线图备注',
    operator: '社区书记-周姐',
    details: '录入3条红线图区域备注：城西小区A区、拆迁区东片、城西小区B区',
    createdAt: '2026-06-05 11:20:00',
  },
  {
    id: 'log-004',
    projectId: 'proj-001',
    action: '检测到数据冲突',
    operator: '系统',
    details: '自动检测到2条公交刷卡与红线图矛盾记录（bus-003、bus-005）',
    createdAt: '2026-06-05 11:25:00',
  },
  {
    id: 'log-005',
    projectId: 'proj-001',
    action: '导入公交刷卡数据',
    operator: '街道规划员-小李',
    details: '导入补录公交刷卡数据1条（CARD005 06:30 城西小区站）',
    createdAt: '2026-06-06 14:00:00',
  },
  {
    id: 'log-006',
    projectId: 'proj-001',
    action: '热力图重算',
    operator: '系统',
    details: '补录数据后自动重算热力图至v1.1，共7条记录参与计算',
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
    title: '复核拆迁区东片热力图',
    description: '该区域夜间采样不足导致热力图偏低，需规划员复核',
    priority: 'high',
    status: 'pending',
    relatedPage: '/heatmap',
  },
  {
    id: 'todo-003',
    title: '处理重复导入记录',
    description: '检测到1条CARD002重复记录，建议去重后重新导入',
    priority: 'medium',
    status: 'pending',
    relatedPage: '/self-check',
  },
  {
    id: 'todo-004',
    title: '导出城西区项目最终报告',
    description: '所有数据确认无误后导出热力图和历史记录',
    priority: 'low',
    status: 'pending',
    relatedPage: '/history',
  },
];
