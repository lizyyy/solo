import { Batch, Sample } from '../types';
import { detectAnomalies } from '../utils/anomalyDetector';

export const mockBatches: Batch[] = [
  {
    id: 'batch-001',
    name: '灰度批次 #20240601-A',
    importTime: '2024-06-01T09:30:00Z',
    modelVersion: 'v2.3.0',
    totalSamples: 12,
    anomalyCount: 3,
  },
  {
    id: 'batch-002',
    name: '灰度批次 #20240602-B',
    importTime: '2024-06-02T14:15:00Z',
    modelVersion: 'v2.3.1',
    totalSamples: 8,
    anomalyCount: 1,
  },
];

const rawSamples: Sample[] = [
  {
    id: 'sample-001',
    batchId: 'batch-001',
    sampleNo: 'SAMPLE-20240601-001',
    currentModelVersion: 'v2.3.0',
    status: 'confirmed_normal',
    createdAt: '2024-06-01T09:31:00Z',
    isAnomaly: false,
    versions: [
      {
        id: 'v1',
        modelVersion: 'v2.3.0',
        tags: { category: '美妆', style: '日常妆容', scene: '室内' },
        timestamp: '2024-06-01T09:31:00Z',
      },
    ],
    comments: [
      {
        id: 'c1',
        author: '标注员',
        content: '正常标注，口红颜色分类准确',
        timestamp: '2024-06-01T10:00:00Z',
      },
    ],
    review: {
      explanation: '样本标签与素材内容一致，模型预测与标注一致，无异常。',
      missingMaterials: [],
      nextOwner: '模型评测小孟',
      updatedAt: '2024-06-01T11:00:00Z',
    },
  },
  {
    id: 'sample-002',
    batchId: 'batch-001',
    sampleNo: 'SAMPLE-20240601-002',
    currentModelVersion: 'v2.3.1',
    status: 'pending_review',
    createdAt: '2024-06-01T09:32:00Z',
    isAnomaly: true,
    versions: [
      {
        id: 'v1',
        modelVersion: 'v2.3.0',
        tags: { category: '服饰', style: '休闲', scene: '户外' },
        timestamp: '2024-06-01T09:32:00Z',
      },
      {
        id: 'v2',
        modelVersion: 'v2.3.1',
        tags: { category: '服饰', style: '商务', scene: '室内' },
        timestamp: '2024-06-01T09:35:00Z',
      },
    ],
    comments: [
      {
        id: 'c2',
        author: '标注员',
        content: '第一次标注的是休闲装，后来模型更新了重跑了一次，标签变了',
        timestamp: '2024-06-01T10:15:00Z',
      },
    ],
    review: {
      explanation: '模型版本从 v2.3.0 升级到 v2.3.1 后，同一样本编号的风格标签从"休闲"变为"商务"，场景从"户外"变为"室内"，需要运营复核确认素材是否真的发生了变化。',
      missingMaterials: ['素材原图对比', '标注员操作日志截图'],
      nextOwner: '运营复核人',
      updatedAt: '2024-06-01T11:30:00Z',
    },
  },
  {
    id: 'sample-003',
    batchId: 'batch-001',
    sampleNo: 'SAMPLE-20240601-003',
    currentModelVersion: 'v2.3.0',
    status: 'confirmed_normal',
    createdAt: '2024-06-01T09:33:00Z',
    isAnomaly: false,
    versions: [
      {
        id: 'v1',
        modelVersion: 'v2.3.0',
        tags: { category: '食品', style: '摆盘', scene: '餐桌' },
        timestamp: '2024-06-01T09:33:00Z',
      },
    ],
    comments: [],
    review: {
      explanation: '正常样本，标签准确。',
      missingMaterials: [],
      nextOwner: '模型评测小孟',
      updatedAt: '2024-06-01T11:00:00Z',
    },
  },
  {
    id: 'sample-004',
    batchId: 'batch-001',
    sampleNo: 'SAMPLE-20240601-004',
    currentModelVersion: 'v2.3.1',
    status: 'pending_review',
    createdAt: '2024-06-01T09:34:00Z',
    isAnomaly: true,
    versions: [
      {
        id: 'v1',
        modelVersion: 'v2.3.0',
        tags: { category: '家居', style: '北欧风', scene: '客厅' },
        timestamp: '2024-06-01T09:34:00Z',
      },
      {
        id: 'v2',
        modelVersion: 'v2.3.1',
        tags: { category: '家居', style: '简约风', scene: '卧室' },
        timestamp: '2024-06-01T09:36:00Z',
      },
    ],
    comments: [],
    review: {
      explanation: '模型版本更新后，同一样本编号的风格和场景标签均发生变化，待小孟补充标注员留言后再复核。',
      missingMaterials: ['标注员留言', '素材原始信息'],
      nextOwner: '模型评测小孟',
      updatedAt: '2024-06-01T11:20:00Z',
    },
  },
  {
    id: 'sample-005',
    batchId: 'batch-001',
    sampleNo: 'SAMPLE-20240601-005',
    currentModelVersion: 'v2.3.0',
    status: 'confirmed_normal',
    createdAt: '2024-06-01T09:37:00Z',
    isAnomaly: false,
    versions: [
      {
        id: 'v1',
        modelVersion: 'v2.3.0',
        tags: { category: '3C', style: '科技感', scene: '桌面' },
        timestamp: '2024-06-01T09:37:00Z',
      },
    ],
    comments: [
      {
        id: 'c3',
        author: '小孟',
        content: '核对过了，标签没问题，是耳机产品',
        timestamp: '2024-06-01T10:30:00Z',
      },
    ],
    review: {
      explanation: '正常样本，模型标签与标注一致。',
      missingMaterials: [],
      nextOwner: '模型评测小孟',
      updatedAt: '2024-06-01T11:00:00Z',
    },
  },
  {
    id: 'sample-006',
    batchId: 'batch-001',
    sampleNo: 'SAMPLE-20240601-006',
    currentModelVersion: 'v2.3.1',
    status: 'pending_review',
    createdAt: '2024-06-01T09:38:00Z',
    isAnomaly: true,
    versions: [
      {
        id: 'v1',
        modelVersion: 'v2.3.0',
        tags: { category: '母婴', style: '温馨', scene: '婴儿房' },
        timestamp: '2024-06-01T09:38:00Z',
      },
      {
        id: 'v2',
        modelVersion: 'v2.3.1',
        tags: { category: '母婴', style: '可爱', scene: '户外' },
        timestamp: '2024-06-01T09:40:00Z',
      },
    ],
    comments: [
      {
        id: 'c4',
        author: '标注员',
        content: '素材是同一张婴儿推车的图，场景确实是户外公园，v2.3.1 更准确',
        timestamp: '2024-06-01T10:45:00Z',
      },
    ],
    review: {
      explanation: '模型版本更新后场景标签发生变化，但标注员确认 v2.3.1 的"户外"更准确。建议运营复核后可归为正常。',
      missingMaterials: [],
      nextOwner: '运营复核人',
      updatedAt: '2024-06-01T11:40:00Z',
    },
  },
  {
    id: 'sample-007',
    batchId: 'batch-002',
    sampleNo: 'SAMPLE-20240602-001',
    currentModelVersion: 'v2.3.1',
    status: 'confirmed_normal',
    createdAt: '2024-06-02T14:16:00Z',
    isAnomaly: false,
    versions: [
      {
        id: 'v1',
        modelVersion: 'v2.3.1',
        tags: { category: '运动', style: '专业', scene: '健身房' },
        timestamp: '2024-06-02T14:16:00Z',
      },
    ],
    comments: [],
    review: {
      explanation: '正常样本。',
      missingMaterials: [],
      nextOwner: '模型评测小孟',
      updatedAt: '2024-06-02T15:00:00Z',
    },
  },
  {
    id: 'sample-008',
    batchId: 'batch-002',
    sampleNo: 'SAMPLE-20240602-002',
    currentModelVersion: 'v2.3.1',
    status: 'needs_attention',
    createdAt: '2024-06-02T14:17:00Z',
    isAnomaly: true,
    versions: [
      {
        id: 'v1',
        modelVersion: 'v2.3.0',
        tags: { category: '图书', style: '教辅', scene: '书桌' },
        timestamp: '2024-06-02T14:17:00Z',
      },
      {
        id: 'v2',
        modelVersion: 'v2.3.1',
        tags: { category: '图书', style: '小说', scene: '书架' },
        timestamp: '2024-06-02T14:20:00Z',
      },
    ],
    comments: [],
    review: {
      explanation: '同一样本编号在两个模型版本中分类完全不同（教辅 vs 小说），需要重点关注。',
      missingMaterials: ['素材原图', '标注员原始标注记录'],
      nextOwner: '模型评测小孟',
      updatedAt: '2024-06-02T15:30:00Z',
    },
  },
];

export const mockSamples: Sample[] = detectAnomalies(rawSamples);
