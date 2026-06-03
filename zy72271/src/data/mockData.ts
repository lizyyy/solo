import type { WorkflowRecord } from '../types';

const generateId = (): string => Math.random().toString(36).substring(2, 11);

const now = new Date();
const formatDate = (d: Date): string => d.toISOString();

const subtractMinutes = (d: Date, mins: number): Date => {
  const result = new Date(d);
  result.setMinutes(result.getMinutes() - mins);
  return result;
};

export const mockRecords: WorkflowRecord[] = [
  {
    id: 'rec-001',
    code: 'SF-A-2026-001',
    type: 'normal',
    typeLabel: '顺利记录',
    status: 'pending',
    statusLabel: '待处理',
    description: '剧场舞台左侧反射点测量，数据完整无异常',
    createdAt: formatDate(subtractMinutes(now, 180)),
    currentStep: 0,
    cadLayers: [
      {
        id: generateId(),
        recordId: 'rec-001',
        name: 'REFLECTION_POINT_MAIN',
        color: '#22c55e',
        objectCount: 12,
        isValid: true,
      },
      {
        id: generateId(),
        recordId: 'rec-001',
        name: 'THEATER_SEATING_AREA',
        color: '#3b82f6',
        objectCount: 48,
        isValid: true,
      },
      {
        id: generateId(),
        recordId: 'rec-001',
        name: 'STAGE_BOUNDARY',
        color: '#f59e0b',
        objectCount: 8,
        isValid: true,
      },
    ],
    rangefinderRecords: [
      {
        id: 'range-001',
        recordId: 'rec-001',
        deviceId: 'DISTO-X310-0042',
        distance: 8.5,
        unit: 'm',
        caliber: 'metric-v2',
        measuredAt: formatDate(subtractMinutes(now, 240)),
        photoUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=laser%20rangefinder%20display%20showing%208.5%20meters%20with%20visible%20red%20warning%20label%20in%20corner%20professional%20construction%20photo&image_size=square',
        hasBlockedWarning: false,
        needsCorrection: false,
        warningLabelVisible: true,
      },
    ],
    corrections: [],
    historyLogs: [
      {
        id: generateId(),
        recordId: 'rec-001',
        step: '系统初始化',
        action: '创建记录',
        operator: '航测内业小魏',
        details: '记录 SF-A-2026-001 创建完成，等待处理',
        timestamp: formatDate(subtractMinutes(now, 180)),
      },
    ],
  },
  {
    id: 'rec-002',
    code: 'SF-B-2026-002',
    type: 'blocked-warning',
    typeLabel: '告警标签被遮挡',
    status: 'pending',
    statusLabel: '待处理',
    description: '剧场观众厅后墙反射点，测距照片被移动端截图遮挡告警标签',
    createdAt: formatDate(subtractMinutes(now, 120)),
    currentStep: 0,
    cadLayers: [
      {
        id: generateId(),
        recordId: 'rec-002',
        name: 'REFLECTION_POINT_BACK_WALL',
        color: '#22c55e',
        objectCount: 15,
        isValid: true,
      },
      {
        id: generateId(),
        recordId: 'rec-002',
        name: 'THEATER_SOUND_ZONE',
        color: '#3b82f6',
        objectCount: 36,
        isValid: true,
      },
      {
        id: generateId(),
        recordId: 'rec-002',
        name: 'AISLE_MARKER',
        color: '#f59e0b',
        objectCount: 12,
        isValid: true,
      },
    ],
    rangefinderRecords: [
      {
        id: 'range-002',
        recordId: 'rec-002',
        deviceId: 'DISTO-X310-0042',
        distance: 12.3,
        unit: 'm',
        caliber: 'metric-v2',
        measuredAt: formatDate(subtractMinutes(now, 200)),
        photoUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=laser%20rangefinder%20display%20partially%20blocked%20by%20mobile%20phone%20screenshot%20overlay%20red%20warning%20label%20hidden%20construction%20site%20photo&image_size=square',
        hasBlockedWarning: true,
        needsCorrection: false,
        warningLabelVisible: false,
      },
    ],
    corrections: [],
    historyLogs: [
      {
        id: generateId(),
        recordId: 'rec-002',
        step: '系统初始化',
        action: '创建记录',
        operator: '航测内业小魏',
        details: '记录 SF-B-2026-002 创建完成，等待处理',
        timestamp: formatDate(subtractMinutes(now, 120)),
      },
    ],
  },
  {
    id: 'rec-003',
    code: 'SF-C-2026-003',
    type: 'old-caliber',
    typeLabel: '旧口径补录',
    status: 'pending',
    statusLabel: '待处理',
    description: '剧场侧墙反射点，测距仪记录使用旧口径（英尺），需要转换为公制单位',
    createdAt: formatDate(subtractMinutes(now, 60)),
    currentStep: 0,
    cadLayers: [
      {
        id: generateId(),
        recordId: 'rec-003',
        name: 'REFLECTION_POINT_SIDE_WALL',
        color: '#22c55e',
        objectCount: 10,
        isValid: true,
      },
      {
        id: generateId(),
        recordId: 'rec-003',
        name: 'THEATER_ACOUSTIC_PANEL',
        color: '#3b82f6',
        objectCount: 24,
        isValid: true,
      },
      {
        id: generateId(),
        recordId: 'rec-003',
        name: 'PROSCENIUM_ARCH',
        color: '#f59e0b',
        objectCount: 6,
        isValid: true,
      },
    ],
    rangefinderRecords: [
      {
        id: 'range-003',
        recordId: 'rec-003',
        deviceId: 'DISTO-X310-0042',
        distance: 27.88,
        unit: 'ft',
        caliber: 'imperial-v1',
        measuredAt: formatDate(subtractMinutes(now, 90)),
        photoUrl: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=laser%20rangefinder%20display%20showing%2027.88%20feet%20old%20display%20units%20visible%20red%20warning%20label%20professional&image_size=square',
        hasBlockedWarning: false,
        needsCorrection: true,
        warningLabelVisible: true,
        originalDistance: 27.88,
        originalUnit: 'ft',
        originalCaliber: 'imperial-v1',
      },
    ],
    corrections: [],
    historyLogs: [
      {
        id: generateId(),
        recordId: 'rec-003',
        step: '系统初始化',
        action: '创建记录',
        operator: '航测内业小魏',
        details: '记录 SF-C-2026-003 创建完成，等待处理',
        timestamp: formatDate(subtractMinutes(now, 60)),
      },
    ],
  },
];

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    'pending': '待处理',
    'cad-imported': 'CAD已导入',
    'under-review': '审核中',
    'pending-manager': '待经理复核',
    'corrected': '已修正',
    'report-generated': '报告已生成',
  };
  return labels[status] || status;
};
