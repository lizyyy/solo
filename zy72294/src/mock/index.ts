import type * as T from '@/types';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function formatDate(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

const baseDate = new Date('2024-06-15T09:00:00');

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

export const rangefinderRecords: T.RangefinderRecord[] = [
  {
    id: generateId(),
    batchNo: 'BATCH-2024-001',
    pointX: 1,
    pointY: 1,
    distance: 0.8,
    screenshotUrl: '/screenshots/batch001-point11.jpg',
    alarmOccluded: false,
    importBatch: 'IMPORT-20240615-001',
    createdAt: formatDate(baseDate),
    createdBy: '小陶',
  },
  {
    id: generateId(),
    batchNo: 'BATCH-2024-001',
    pointX: 1,
    pointY: 1,
    distance: 0.8,
    screenshotUrl: '/screenshots/batch001-point11.jpg',
    alarmOccluded: false,
    importBatch: 'IMPORT-20240615-002',
    createdAt: formatDate(addMinutes(baseDate, 120)),
    createdBy: '小陶',
  },
  {
    id: generateId(),
    batchNo: 'BATCH-2024-002',
    pointX: 2,
    pointY: 1,
    distance: 1.0,
    screenshotUrl: '/screenshots/batch002-point21.jpg',
    alarmOccluded: false,
    importBatch: 'IMPORT-20240615-001',
    createdAt: formatDate(addMinutes(baseDate, 5)),
    createdBy: '小陶',
  },
  {
    id: generateId(),
    batchNo: 'BATCH-2024-002',
    pointX: 2,
    pointY: 1,
    distance: 1.0,
    screenshotUrl: '/screenshots/batch002-point21.jpg',
    alarmOccluded: false,
    importBatch: 'IMPORT-20240615-002',
    createdAt: formatDate(addMinutes(baseDate, 125)),
    createdBy: '小陶',
  },
  {
    id: generateId(),
    batchNo: 'BATCH-2024-003',
    pointX: 3,
    pointY: 1,
    distance: 3.2,
    screenshotUrl: '/screenshots/batch003-point31.jpg',
    alarmOccluded: true,
    importBatch: 'IMPORT-20240615-001',
    createdAt: formatDate(addMinutes(baseDate, 10)),
    createdBy: '小陶',
  },
  {
    id: generateId(),
    batchNo: 'BATCH-2024-004',
    pointX: 1,
    pointY: 2,
    distance: 4.5,
    screenshotUrl: '/screenshots/batch004-point12.jpg',
    alarmOccluded: true,
    importBatch: 'IMPORT-20240615-001',
    createdAt: formatDate(addMinutes(baseDate, 15)),
    createdBy: '小陶',
  },
  {
    id: generateId(),
    batchNo: 'BATCH-2024-005',
    pointX: 2,
    pointY: 2,
    distance: 5.2,
    screenshotUrl: '/screenshots/batch005-point22.jpg',
    alarmOccluded: false,
    importBatch: 'IMPORT-20240615-001',
    createdAt: formatDate(addMinutes(baseDate, 20)),
    createdBy: '小陶',
  },
  {
    id: generateId(),
    batchNo: 'BATCH-2024-006',
    pointX: 3,
    pointY: 2,
    distance: 6.5,
    screenshotUrl: '/screenshots/batch006-point32.jpg',
    alarmOccluded: false,
    importBatch: 'IMPORT-20240615-001',
    createdAt: formatDate(addMinutes(baseDate, 25)),
    createdBy: '小陶',
  },
];

const uniqueRecords = rangefinderRecords.filter(
  (r, i, arr) => arr.findIndex((x) => x.batchNo === r.batchNo && x.pointX === r.pointX && x.pointY === r.pointY) === i
);

export const volumeEstimations: T.VolumeEstimation[] = uniqueRecords.map((record, index) => {
  const models: Array<'cone' | 'cuboid' | 'irregular'> = ['cone', 'cuboid', 'cone', 'irregular', 'cone', 'cuboid'];
  const model = models[index];
  const height = 6.5 - record.distance;
  let volume: number;
  let params: Record<string, number>;
  let tradeoffReason: string;

  if (model === 'cone') {
    const radius = 2.5;
    volume = (1 / 3) * Math.PI * radius * radius * height;
    params = { height, radius, pi: Math.PI };
    tradeoffReason = '取锥体模型而非长方体，因堆垛顶部呈锥形，顶部边缘逐渐收窄，锥体模型更接近实际形状';
  } else if (model === 'cuboid') {
    const length = 5;
    const width = 4;
    volume = length * width * height;
    params = { length, width, height };
    tradeoffReason = '取长方体模型，因堆垛形状规整，四壁接近垂直，长方体计算简单且误差在可接受范围内';
  } else {
    volume = 45 + Math.random() * 20;
    params = { height, topArea: 12, bottomArea: 18, coefficient: 0.92 };
    tradeoffReason = '采用不规则体模型（拟柱体公式），因堆垛侧面有凹陷，需结合顶底面积加权计算';
  }

  return {
    id: generateId(),
    recordId: record.id,
    volume: Math.round(volume * 100) / 100,
    calculationModel: model,
    paramVersion: 'v1.2.0',
    tradeoffReason,
    calculationParams: Object.fromEntries(
      Object.entries(params).map(([k, v]) => [k, Math.round((v as number) * 1000) / 1000])
    ),
    calculatedAt: formatDate(addMinutes(baseDate, 30 + index * 5)),
  };
});

export const obstacleNotes: T.ObstacleNote[] = uniqueRecords.map((record, index) => {
  const contents = [
    'A区1号堆垛东侧靠墙，距离墙体实测0.8米，小于安全距离1.2米，需重点关注。堆垛表面有少量杂物堆积，可能影响通行。',
    'A区2号堆垛南侧靠近通道，距离通道边缘1.0米，小于安全距离。堆垛顶部有局部坍塌迹象，需安排整理。',
    'B区1号堆垛北侧靠近消防设施，距离3.2米。截图被手指遮挡部分告警标签，请经理复核。',
    'B区2号堆垛西侧靠近电源箱，距离4.5米。截图右上角被遮挡，可能影响告警标签识别。',
    'C区1号堆垛位于仓库中央，距离周围障碍物均大于5米，状态正常。',
    'C区2号堆垛靠近出口，距离6.5米，状态良好，堆垛规整无异常。',
  ];
  const statuses: Array<'pending' | 'completed' | 'verify'> = ['completed', 'completed', 'pending', 'completed', 'pending', 'completed'];

  return {
    id: generateId(),
    recordId: record.id,
    content: contents[index],
    status: statuses[index],
    updatedAt: formatDate(addMinutes(baseDate, 60 + index * 10)),
    updatedBy: statuses[index] === 'pending' ? '' : '小陶',
  };
});

export const alarmReviews: T.AlarmReview[] = uniqueRecords
  .filter((r) => r.alarmOccluded)
  .map((record) => ({
    id: generateId(),
    recordId: record.id,
    reviewStatus: 'pending' as const,
    reviewComment: '',
    reviewedAt: '',
    reviewedBy: '',
  }));

export const safetyReports: T.SafetyReport[] = uniqueRecords
  .filter((r, i) => i < 2)
  .map((record, index) => {
    const reasons = [
      `实测距离仅${record.distance}米，小于安全距离标准1.2米，需保留此告警。堆垛靠近墙体，万一发生倾斜可能直接撞击墙体结构，存在安全隐患。`,
      `实测距离${record.distance}米，小于安全距离标准1.2米。堆垛位于通道旁，人员搬运货物时易碰撞，且顶部有坍塌迹象，需尽快处理。`,
    ];
    const missingMaterialsList = [
      ['隔离桩3根', '警示带2卷', '安全警示牌1块'],
      ['隔离桩2根', '警示带1卷', '手套5副', '防尘口罩10个'],
    ];
    const nextSteps = [
      '联系施工经理协调人员设置隔离区域，待堆垛清运后再解除警戒。',
      '安排园区运维人员整理堆垛顶部，设置临时警示标志，后续评估是否需要转移部分货物。',
    ];
    const owners: Array<'manager' | 'operator'> = ['manager', 'operator'];

    return {
      id: generateId(),
      recordId: record.id,
      reason: reasons[index],
      missingMaterials: missingMaterialsList[index],
      nextStep: nextSteps[index],
      nextOwner: owners[index],
      status: 'confirmed',
      createdAt: formatDate(addMinutes(baseDate, 180 + index * 15)),
    };
  });

const completedNotes = obstacleNotes.filter((n) => n.status === 'completed');
export const changeHistories: T.ChangeHistory[] = [
  {
    id: generateId(),
    entityType: 'obstacle_note',
    entityId: completedNotes[0].id,
    fieldName: 'content',
    oldValue: 'A区1号堆垛东侧靠墙，距离较近，需关注。',
    newValue: completedNotes[0].content,
    operator: '小陶',
    operatedAt: formatDate(addMinutes(baseDate, 90)),
  },
  {
    id: generateId(),
    entityType: 'obstacle_note',
    entityId: completedNotes[1].id,
    fieldName: 'content',
    oldValue: 'A区2号堆垛南侧靠近通道，距离较近，需注意。',
    newValue: completedNotes[1].content,
    operator: '小陶',
    operatedAt: formatDate(addMinutes(baseDate, 100)),
  },
];

export const duplicateRecordIds = rangefinderRecords
  .filter((r, i, arr) => arr.findIndex((x) => x.batchNo === r.batchNo && x.pointX === r.pointX && x.pointY === r.pointY) !== i)
  .map((r) => r.id);

export interface MockData {
  rangefinderRecords: T.RangefinderRecord[];
  volumeEstimations: T.VolumeEstimation[];
  obstacleNotes: T.ObstacleNote[];
  alarmReviews: T.AlarmReview[];
  safetyReports: T.SafetyReport[];
  changeHistories: T.ChangeHistory[];
  duplicateRecordIds: string[];
}

export const mockData: MockData = {
  rangefinderRecords,
  volumeEstimations,
  obstacleNotes,
  alarmReviews,
  safetyReports,
  changeHistories,
  duplicateRecordIds,
};

export default mockData;
