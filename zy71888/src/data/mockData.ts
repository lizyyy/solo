import { AnomalyPhoto, ScanReport, ValidationResult, OperationLog, PointStatus } from '../types';

export const mockPhotos: AnomalyPhoto[] = [
  {
    id: 'photo-1',
    name: '磁场异常点-20240515-01',
    url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=magnetic%20field%20anomaly%20graph%20with%20red%20markers%20on%20scientific%20paper&image_size=square',
    tags: ['unit_error', 'zero_drift'],
    timestamp: '2024-05-15 14:32:00',
    uploader: '张助教',
    description: '该点单位换算错误，将 Gs 误写为 mT，且存在零点漂移现象',
    sensorLogs: [
      {
        id: 'log-1',
        name: 'sensor_data_20240515.csv',
        type: 'csv',
        url: '#',
      },
    ],
    corrections: [
      {
        id: 'corr-1-v1',
        content: '该数据点单位换算错误，实际值应为 125 Gs = 12.5 mT，需要重新计算。',
        version: 1,
        timestamp: '2024-05-15 15:00:00',
        author: '张助教',
        isLatest: false,
      },
      {
        id: 'corr-1-v2',
        content: '该数据点单位换算错误，实际值应为 125 Gs = 12.5 mT，需要重新计算。另外发现零点漂移约 2.3 mT，已修正。',
        version: 2,
        timestamp: '2024-05-15 16:30:00',
        author: '李老师',
        isLatest: true,
      },
    ],
  },
  {
    id: 'photo-2',
    name: '采样缺口-20240516-02',
    url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=scientific%20data%20graph%20showing%20missing%20data%20points%20gap&image_size=square',
    tags: ['sample_gap'],
    timestamp: '2024-05-16 09:15:00',
    uploader: '王助教',
    description: '10:00-10:30 时间段数据缺失，传感器通信中断',
    sensorLogs: [
      {
        id: 'log-2',
        name: 'sensor_log_20240516.txt',
        type: 'text',
        url: '#',
      },
    ],
    corrections: [
      {
        id: 'corr-2-v1',
        content: '采样缺口已标记为待确认，建议使用线性插值补全或重新实验。',
        version: 1,
        timestamp: '2024-05-16 10:00:00',
        author: '王助教',
        isLatest: true,
      },
    ],
  },
  {
    id: 'photo-3',
    name: '微信群截图-补图证明',
    url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=wechat%20chat%20screenshot%20showing%20data%20correction%20discussion&image_size=square',
    tags: ['other'],
    timestamp: '2024-05-17 11:20:00',
    uploader: '张助教',
    description: '微信群中与学生确认的数据修正说明截图',
    sensorLogs: [],
    corrections: [],
  },
  {
    id: 'photo-4',
    name: '实验纸扫描件',
    url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=handwritten%20lab%20notebook%20page%20with%20physics%20calculations&image_size=square',
    tags: ['other'],
    timestamp: '2024-05-17 14:45:00',
    uploader: '李助教',
    description: '原始实验记录纸扫描件，用于核对手写数据',
    sensorLogs: [],
    corrections: [
      {
        id: 'corr-4-v1',
        content: '实验纸第3行数据与传感器日志不符，以传感器为准。',
        version: 1,
        timestamp: '2024-05-17 15:00:00',
        author: '李助教',
        isLatest: true,
      },
    ],
  },
];

const generateScanPoints = (): ScanReport['points'] => {
  const points: ScanReport['points'] = [];
  const gridSize = 10;
  
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const baseValue = 50 + Math.sin(i * 0.5) * 20 + Math.cos(j * 0.3) * 15;
      const noise = (Math.random() - 0.5) * 10;
      let value = baseValue + noise;
      let status: PointStatus = 'normal';
      let linkedPhotoId: string | undefined;
      let notes: string | undefined;
      
      if (i === 3 && j === 5) {
        value = 120;
        status = 'anomaly';
        linkedPhotoId = 'photo-1';
        notes = '单位换算错误，已绑定异常照片';
      } else if (i === 7 && j === 2) {
        value = 85;
        status = 'pending';
        notes = '待确认：可能存在零点漂移';
      } else if (i === 5 && j === 8) {
        value = 0;
        status = 'excluded';
        linkedPhotoId = 'photo-2';
        notes = '采样缺口，数据缺失';
      }
      
      points.push({
        id: `point-${i}-${j}`,
        x: i,
        y: j,
        value: Math.round(value * 100) / 100,
        status,
        linkedPhotoId,
        notes,
      });
    }
  }
  return points;
};

export const mockScanReports: ScanReport[] = [
  {
    id: 'report-1',
    name: '磁场扫描图-样本A-20240515',
    version: 2,
    createdAt: '2024-05-15 17:00:00',
    author: '张助教',
    notes: '已修正单位换算错误，标记了3个异常点和1个采样缺口',
    points: generateScanPoints(),
  },
];

export const mockValidationResults: ValidationResult[] = [
  {
    id: 'val-1',
    type: 'unit_error',
    severity: 'high',
    description: '检测到单位混淆：数据点 (3,5) 标注为 mT，实际应为 m Gs = 12.5 mT，值相差 10 倍',
    location: { start: 25, end: 26 },
    suggestion: '将 m 除以 10 进行单位换算',
    dataPointId: 'point-3-5',
  },
  {
    id: 'val-2',
    type: 'zero_drift',
    severity: 'medium',
    description: '检测到零点漂移：基线偏移约 2.3 mT',
    location: { start: 0, end: 100 },
    suggestion: '使用空白样品重新校准零点',
  },
  {
    id: 'val-3',
    type: 'sample_gap',
    severity: 'high',
    description: '检测到采样缺口：第 45-55 号数据点缺失',
    location: { start: 45, end: 55 },
    suggestion: '线性插值补全或重新采集数据',
    dataPointId: 'point-5-8',
  },
  {
    id: 'val-4',
    type: 'zero_drift',
    severity: 'low',
    description: '轻微零点漂移 < 0.5 mT，在误差允许范围内',
    location: { start: 0, end: 100 },
    suggestion: '无需处理，建议记录备案',
  },
];

export const mockOperationLogs: OperationLog[] = [
  {
    id: 'log-op-1',
    action: '上传照片',
    entityType: 'AnomalyPhoto',
    entityId: 'photo-1',
    timestamp: '2024-05-15 14:32:00',
    operator: '张助教',
    details: '上传异常照片「磁场异常点-20240515-01」',
  },
  {
    id: 'log-op-2',
    action: '添加批改意见',
    entityType: 'Correction',
    entityId: 'corr-1-v1',
    timestamp: '2024-05-15 15:00:00',
    operator: '张助教',
    details: '为照片 photo-1 添加批改意见 v1',
  },
  {
    id: 'log-op-3',
    action: '更新批改意见',
    entityType: 'Correction',
    entityId: 'corr-1-v2',
    timestamp: '2024-05-15 16:30:00',
    operator: '李老师',
    details: '更新批改意见至 v2，补充零点漂移说明',
  },
  {
    id: 'log-op-4',
    action: '生成扫描报告',
    entityType: 'ScanReport',
    entityId: 'report-1',
    timestamp: '2024-05-15 17:00:00',
    operator: '张助教',
    details: '生成磁场扫描图报告「磁场扫描图-样本A-20240515」v2',
  },
  {
    id: 'log-op-5',
    action: '关联证据',
    entityType: 'ScanPoint',
    entityId: 'point-3-5',
    timestamp: '2024-05-15 17:05:00',
    operator: '张助教',
    details: '将数据点 point-3-5 关联到异常照片 photo-1',
  },
  {
    id: 'log-op-6',
    action: '上传照片',
    entityType: 'AnomalyPhoto',
    entityId: 'photo-2',
    timestamp: '2024-05-16 09:15:00',
    operator: '王助教',
    details: '上传异常照片「采样缺口-20240516-02」',
  },
];

export const tagLabels: Record<string, string> = {
  unit_error: '单位错误',
  zero_drift: '零点漂移',
  sample_gap: '采样缺口',
  other: '其他',
};

export const tagColors: Record<string, string> = {
  unit_error: '#F53F3F',
  zero_drift: '#FF7D00',
  sample_gap: '#722ED1',
  other: '#86909C',
};

export const statusLabels: Record<string, string> = {
  normal: '正常',
  anomaly: '异常',
  pending: '待确认',
  excluded: '已排除',
};

export const statusColors: Record<string, string> = {
  normal: '#00B42A',
  anomaly: '#F53F3F',
  pending: '#FF7D00',
  excluded: '#86909C',
};
