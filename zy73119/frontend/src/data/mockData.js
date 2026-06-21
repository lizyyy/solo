// 演示数据 - 旧楼测绘交底清单
// 包含楼层、房间、测点、异常、材料送审历史、坐标偏移、可执行动作

export const STANDARD = {
  version: 'v2.4-202606',
  desc: '旧楼测绘交底清单口径：空间位置精度±50mm，异常等级按偏移量分级，材料送审表保留所有版本历史',
  updatedAt: '2026-06-19',
};

export const FLOORS = [
  { id: 'B1', name: 'B1 设备层', height: 3500, anomalyCount: 1, itemCount: 1 },
  { id: '1F', name: '1 层大堂', height: 4200, anomalyCount: 1, itemCount: 1 },
  { id: '2F', name: '2 层办公区', height: 3600, anomalyCount: 1, itemCount: 1 },
  { id: '3F', name: '3 层会议室', height: 3200, anomalyCount: 2, itemCount: 2 },
  { id: 'RF', name: '屋面', height: 0, anomalyCount: 1, itemCount: 1 },
];

// 3F 简化平面图 - 房间轮廓坐标 (SVG viewBox 0 0 800 600)
export const ROOMS_3F = [
  { id: 'R301', name: '西侧会议室', x: 40, y: 40, w: 340, h: 220, color: '#f0f9ff' },
  { id: 'R302', name: '东侧会议室', x: 420, y: 40, w: 340, h: 220, color: '#f0fdf4' },
  { id: 'R303', name: '走廊', x: 40, y: 280, w: 720, h: 60, color: '#f9fafb' },
  { id: 'R304', name: '办公室A', x: 40, y: 360, w: 220, h: 200, color: '#fefce8' },
  { id: 'R305', name: '办公室B', x: 280, y: 360, w: 240, h: 200, color: '#fefce8' },
  { id: 'R306', name: '储物间', x: 540, y: 360, w: 220, h: 200, color: '#faf5ff' },
];

// 测点 - 3F
export const POINTS_3F = [
  {
    id: 1,
    itemNo: 'OLD-BLDG-001',
    floorId: '3F',
    roomId: 'R303',
    name: '走廊西侧墙体',
    x: 80, y: 310,
    modelRef: 'X:1200.500,Y:850.300,Z:3000.000',
    hasAnomaly: true,
    anomalyLevel: '高',
    anomalyType: '坐标偏移超限',
    anomalyNote: '墙体位置偏移68mm，超过容差50mm',
    status: '处理中',
    coordinator: '小岑',
    operator: '算法值班人A',
    offset: { x: 68, y: 12, z: 0, distance: 69.1, exceeds: true },
    batchId: 'BATCH-20260619-3ea489',
    materials: ['防水卷材', '涂料'],
    actionItems: ['复测', '回写模型', '补充材料依据'],
    createdAt: '2026-06-18T23:39:35',
    updatedAt: '2026-06-19T00:41:06',
  },
  {
    id: 2,
    itemNo: 'OLD-BLDG-004',
    floorId: '3F',
    roomId: 'R301',
    name: '会议室门洞',
    x: 200, y: 150,
    modelRef: 'X:2100.000,Y:6300.000,Z:2000.000',
    hasAnomaly: false,
    anomalyLevel: '',
    anomalyType: '',
    anomalyNote: '',
    status: '已闭环',
    coordinator: '小岑',
    operator: '算法值班人B',
    offset: { x: 8, y: 5, z: 2, distance: 9.6, exceeds: false },
    batchId: 'BATCH-20260619-3ea489',
    materials: ['防火门'],
    actionItems: [],
    createdAt: '2026-06-18T23:39:35',
    updatedAt: '2026-06-19T00:41:06',
  },
];

// 1F
export const ROOMS_1F = [
  { id: 'R101', name: '大堂', x: 40, y: 40, w: 520, h: 360, color: '#f0f9ff' },
  { id: 'R102', name: '接待室', x: 580, y: 40, w: 200, h: 180, color: '#f0fdf4' },
  { id: 'R103', name: '设备间', x: 580, y: 240, w: 200, h: 160, color: '#faf5ff' },
  { id: 'R104', name: '大厅柱子', x: 280, y: 200, w: 80, h: 80, color: '#e5e7eb' },
];

export const POINTS_1F = [
  {
    id: 3,
    itemNo: 'OLD-BLDG-002',
    floorId: '1F',
    roomId: 'R101',
    name: '大堂柱子截面',
    x: 320, y: 240,
    modelRef: 'X:3500.000,Y:2200.000,Z:0.000',
    hasAnomaly: false,
    anomalyLevel: '',
    anomalyType: '',
    anomalyNote: '',
    status: '已闭环',
    coordinator: '小岑',
    operator: '算法值班人B',
    offset: { x: 3, y: 4, z: 0, distance: 5, exceeds: false },
    batchId: 'BATCH-20260619-3ea489',
    materials: ['混凝土标号C30'],
    actionItems: [],
    createdAt: '2026-06-18T23:39:35',
    updatedAt: '2026-06-19T00:41:06',
  },
];

// 2F
export const ROOMS_2F = [
  { id: 'R201', name: '开放式办公', x: 40, y: 40, w: 720, h: 520, color: '#fefce8' },
  { id: 'R202', name: '会议室', x: 580, y: 40, w: 180, h: 140, color: '#f0f9ff' },
];

export const POINTS_2F = [
  {
    id: 4,
    itemNo: 'OLD-BLDG-003',
    floorId: '2F',
    roomId: 'R201',
    name: '设备基础标高',
    x: 400, y: 300,
    modelRef: 'X:5800.000,Y:1200.000,Z:-3500.000',
    hasAnomaly: true,
    anomalyLevel: '中',
    anomalyType: '标高偏差',
    anomalyNote: '标高偏差32mm，需确认是否影响设备安装',
    status: '待处理',
    coordinator: '小岑',
    operator: '算法值班人A',
    offset: { x: 5, y: 8, z: 32, distance: 33.2, exceeds: false },
    batchId: 'BATCH-20260619-3ea489',
    materials: ['设备基座钢板'],
    actionItems: ['复测', '锁定偏移'],
    createdAt: '2026-06-18T23:39:35',
    updatedAt: '2026-06-19T00:41:06',
  },
];

// B1
export const ROOMS_B1 = [
  { id: 'RB01', name: '设备层主空间', x: 40, y: 40, w: 720, h: 520, color: '#f3f4f6' },
  { id: 'RB02', name: '配电间', x: 580, y: 40, w: 180, h: 180, color: '#fee2e2' },
];

export const POINTS_B1 = [
  {
    id: 5,
    itemNo: 'OLD-BLDG-005',
    floorId: 'B1',
    roomId: 'RB02',
    name: '配电间管线预留',
    x: 660, y: 130,
    modelRef: 'X:4200.000,Y:3800.000,Z:6000.000',
    hasAnomaly: true,
    anomalyLevel: '低',
    anomalyType: '管线偏差',
    anomalyNote: '现场做法与模型标注略有差异，不影响使用',
    status: '处理中',
    coordinator: '小岑',
    operator: '算法值班人A',
    offset: { x: 18, y: 8, z: 0, distance: 19.7, exceeds: false },
    batchId: 'BATCH-20260619-3ea489',
    materials: ['电缆桥架'],
    actionItems: ['补充材料依据'],
    createdAt: '2026-06-18T23:39:35',
    updatedAt: '2026-06-19T00:41:06',
  },
];

// 屋面 RF
export const ROOMS_RF = [
  { id: 'RR01', name: '屋面防水区', x: 40, y: 40, w: 720, h: 520, color: '#fef3c7' },
  { id: 'RR02', name: '电梯机房', x: 580, y: 40, w: 180, h: 160, color: '#d1fae5' },
];

export const POINTS_RF = [
  {
    id: 6,
    itemNo: 'OLD-BLDG-006',
    floorId: 'RF',
    roomId: 'RR01',
    name: '屋面防水卷材搭接边',
    x: 200, y: 280,
    modelRef: 'X:4200.000,Y:3800.000,Z:6000.000',
    hasAnomaly: true,
    anomalyLevel: '高',
    anomalyType: '材料不符',
    anomalyNote: '现场卷材型号与送审版本不一致，搭接宽度偏差',
    status: '待处理',
    coordinator: '小岑',
    operator: '算法值班人A',
    offset: { x: 0, y: 0, z: 0, distance: 0, exceeds: false },
    batchId: 'BATCH-20260619-3ea489',
    materials: ['防水卷材'],
    actionItems: ['复测', '补充材料依据'],
    createdAt: '2026-06-18T23:39:35',
    updatedAt: '2026-06-19T00:41:06',
  },
];

export const FLOOR_DATA = {
  '3F': { rooms: ROOMS_3F, points: POINTS_3F },
  '1F': { rooms: ROOMS_1F, points: POINTS_1F },
  '2F': { rooms: ROOMS_2F, points: POINTS_2F },
  'B1': { rooms: ROOMS_B1, points: POINTS_B1 },
  'RF': { rooms: ROOMS_RF, points: POINTS_RF },
};

// 材料送审历史（所有版本，含备注和截图）
export const MATERIAL_HISTORY = {
  '防水卷材': [
    {
      id: 'm1-v3',
      materialName: '防水卷材',
      version: 3,
      isCurrent: true,
      specification: 'SBS 改性沥青防水卷材 4mm 厚 I 型',
      supplier: '东方雨虹',
      submittedBy: '算法值班人A',
      remark: '最终版：根据 B1 设备层实测调整了搭接宽度，由 100mm 调整为 120mm',
      screenshotUrl: '/mock/screenshot-3.png',
      createdAt: '2026-06-18T16:30:00',
    },
    {
      id: 'm1-v2',
      materialName: '防水卷材',
      version: 2,
      isCurrent: false,
      specification: 'SBS 改性沥青防水卷材 4mm 厚',
      supplier: '东方雨虹',
      submittedBy: '小岑',
      remark: 'v2 补充：屋面做法改为两层叠层，总厚 7mm',
      screenshotUrl: '/mock/screenshot-2.png',
      createdAt: '2026-06-15T10:20:00',
    },
    {
      id: 'm1-v1',
      materialName: '防水卷材',
      version: 1,
      isCurrent: false,
      specification: 'SBS 改性沥青防水卷材 3mm 厚',
      supplier: '科顺防水',
      submittedBy: '小岑',
      remark: '初版送审，搭接宽度 100mm',
      screenshotUrl: '/mock/screenshot-1.png',
      createdAt: '2026-06-10T14:00:00',
    },
  ],
  '涂料': [
    {
      id: 'm2-v2',
      materialName: '涂料',
      version: 2,
      isCurrent: true,
      specification: '内墙乳胶漆 白色 哑光',
      supplier: '立邦',
      submittedBy: '算法值班人B',
      remark: 'v2 变更：走廊改为耐擦洗版本',
      screenshotUrl: '/mock/screenshot-p2.png',
      createdAt: '2026-06-16T09:00:00',
    },
    {
      id: 'm2-v1',
      materialName: '涂料',
      version: 1,
      isCurrent: false,
      specification: '内墙乳胶漆 白色',
      supplier: '多乐士',
      submittedBy: '小岑',
      remark: '初版送审',
      screenshotUrl: '/mock/screenshot-p1.png',
      createdAt: '2026-06-12T11:30:00',
    },
  ],
  '防火门': [
    {
      id: 'm3-v1',
      materialName: '防火门',
      version: 1,
      isCurrent: true,
      specification: '甲级防火门 1000x2100 木质',
      supplier: '盼盼',
      submittedBy: '小岑',
      remark: '会议室门洞，已通过消防审图',
      screenshotUrl: '/mock/screenshot-door.png',
      createdAt: '2026-06-14T15:00:00',
    },
  ],
  '混凝土标号C30': [
    {
      id: 'm4-v1',
      materialName: '混凝土标号C30',
      version: 1,
      isCurrent: true,
      specification: 'C30 混凝土 泵送 坍落度 160mm',
      supplier: '中建商砼',
      submittedBy: '小岑',
      remark: '大堂结构柱设计标号',
      screenshotUrl: '/mock/screenshot-concrete.png',
      createdAt: '2026-06-08T10:00:00',
    },
  ],
  '设备基座钢板': [
    {
      id: 'm5-v1',
      materialName: '设备基座钢板',
      version: 1,
      isCurrent: true,
      specification: 'Q235 钢板 20mm 厚 防腐处理',
      supplier: '鞍钢',
      submittedBy: '算法值班人A',
      remark: '设备基础预埋钢板',
      screenshotUrl: '/mock/screenshot-plate.png',
      createdAt: '2026-06-13T14:00:00',
    },
  ],
  '电缆桥架': [
    {
      id: 'm6-v2',
      materialName: '电缆桥架',
      version: 2,
      isCurrent: true,
      specification: '镀锌桥架 200x100 槽式',
      supplier: '西门子',
      submittedBy: '算法值班人A',
      remark: 'v2 升级为防火桥架',
      screenshotUrl: '/mock/screenshot-tray2.png',
      createdAt: '2026-06-17T11:00:00',
    },
    {
      id: 'm6-v1',
      materialName: '电缆桥架',
      version: 1,
      isCurrent: false,
      specification: '镀锌桥架 150x75 槽式',
      supplier: '西门子',
      submittedBy: '小岑',
      remark: '初版送审',
      screenshotUrl: '/mock/screenshot-tray1.png',
      createdAt: '2026-06-11T10:00:00',
    },
  ],
};

// 可执行动作定义
export const ACTION_DEFS = {
 复测: {
    icon: '📐',
    desc: '安排现场重新测量，确认偏移量真实有效',
    owner: 'BIM协调员（小岑）',
    warnLevel: 'info',
  },
 锁定偏移: {
    icon: '🔒',
    desc: '确认偏移在容差内，锁定当前偏移值作为施工基准',
    owner: '算法值班人',
    warnLevel: 'warn',
  },
 回写模型: {
    icon: '🏗️',
    desc: '将实测坐标回写进 BIM 模型，更新版本号',
    owner: 'BIM协调员（小岑）→ 模型组',
    warnLevel: 'danger',
  },
 补充材料依据: {
    icon: '📋',
    desc: '补充材料送审表版本及备注，确保来源可追溯',
    owner: '算法值班人 → 采购组',
    warnLevel: 'warn',
  },
};

// 异常追溯链路 (按异常点 ID 索引)
export const ANOMALY_TRACES = {
  1: [
    { step: 1, from: '汇总看板', to: '3F 走廊', reason: '跑批检测到坐标偏移超限', operator: '算法值班人A', time: '2026-06-18 23:40' },
    { step: 2, from: '3F 走廊', to: '现场测量', reason: '人工复测确认墙体西偏 68mm', operator: '小岑', time: '2026-06-19 08:15' },
    { step: 3, from: '现场测量', to: '材料追溯', reason: '检查防水卷材送审 v1 与现场型号是否匹配', operator: '算法值班人A', time: '2026-06-19 09:30' },
  ],
  4: [
    { step: 1, from: '汇总看板', to: '2F 设备基础', reason: '标高偏差 32mm', operator: '算法值班人A', time: '2026-06-18 23:41' },
  ],
  6: [
    { step: 1, from: '汇总看板', to: '屋面防水区', reason: '材料型号与送审不一致', operator: '算法值班人A', time: '2026-06-18 23:42' },
    { step: 2, from: '屋面防水区', to: '材料送审记录', reason: '对照防水卷材 v3 备注发现搭接宽度不匹配', operator: '算法值班人A', time: '2026-06-19 09:00' },
  ],
  5: [
    { step: 1, from: '汇总看板', to: 'B1 配电间', reason: '桥架走向与模型有差异', operator: '算法值班人B', time: '2026-06-18 23:43' },
  ],
};

// 汇总统计
export function computeStats() {
  const allPoints = Object.values(FLOOR_DATA).flatMap(f => f.points);
  const anomalies = allPoints.filter(p => p.hasAnomaly);
  const highAnomalies = anomalies.filter(p => p.anomalyLevel === '高');
  const pending = allPoints.filter(p => p.status === '待处理' || p.status === '处理中');
  const offsetsExceed = allPoints.filter(p => p.offset && p.offset.exceeds);
  const actionCount = allPoints.reduce((sum, p) => sum + (p.actionItems?.length || 0), 0);
  const materialGaps = anomalies.filter(p => p.anomalyType === '材料不符');

  return {
    total: allPoints.length,
    anomalies: anomalies.length,
    highAnomalies: highAnomalies.length,
    pendingActions: actionCount,
    offsetsExceed: offsetsExceed.length,
    materialGaps: materialGaps.length,
    closed: allPoints.filter(p => p.status === '已闭环').length,
    pending: pending.length,
  };
}
