import type { TrackBatch, TrackRun, MaterialItem, CollisionPoint, MeetingNote } from '@/types';

const now = Date.now();
const hour = 3600 * 1000;

export const mockBatch: TrackBatch = {
  batchId: 'BATCH001',
  name: '屋面排水系统-东标段',
  status: 'reviewed',
  createdAt: new Date(now - 48 * hour).toISOString(),
  samplePackName: '标准样例包A',
  currentRunId: 'RUN003',
};

export const mockRuns: TrackRun[] = [
  {
    runId: 'RUN001',
    batchId: 'BATCH001',
    runNumber: 1,
    remark: '首次执行-原始数据',
    executedAt: new Date(now - 48 * hour).toISOString(),
    resultStatus: 'warning',
    drawingVersion: 'V1.0',
    materialCount: 42,
    collisionCount: 8,
    abnormalCount: 5,
  },
  {
    runId: 'RUN002',
    batchId: 'BATCH001',
    runNumber: 2,
    remark: '修正雨水斗位置偏移',
    executedAt: new Date(now - 24 * hour).toISOString(),
    resultStatus: 'success',
    drawingVersion: 'V1.1',
    materialCount: 45,
    collisionCount: 3,
    abnormalCount: 2,
  },
  {
    runId: 'RUN003',
    batchId: 'BATCH001',
    runNumber: 3,
    remark: '复核人补充管道密封件清单',
    executedAt: new Date(now - 2 * hour).toISOString(),
    resultStatus: 'success',
    drawingVersion: 'V1.2',
    materialCount: 48,
    collisionCount: 3,
    abnormalCount: 0,
  },
];

const materialTypes: MaterialItem['materialType'][] = ['pipe', 'hopper', 'gutter', 'fitting', 'sealant'];
const statuses: MaterialItem['processingStatus'][] = ['confirmed', 'pending', 'conflicted', 'obsolete'];

function generateMaterials(runId: string, count: number, offset: number): MaterialItem[] {
  return Array.from({ length: count }, (_, i) => ({
    materialId: `MAT-${runId}-${String(i + 1).padStart(3, '0')}`,
    runId,
    standardName: [
      'DN100排水立管', 'DN75雨水斗', '300mm天沟', '90度弯头',
      '密封胶条', 'DN150横管', '方形雨水斗', '伸缩节', '检查口', '异径三通',
    ][(i + offset) % 10] + `-${i + 1}`,
    materialType: materialTypes[(i + offset) % 5],
    processingStatus: statuses[(i + offset) % 4],
    sourceNoteId: 'NOTE001',
    sourceNoteNumber: 'HY-2024-015',
    threeMeshId: `mesh_${runId}_${i}`,
    drawingVersion: runId === 'RUN001' ? 'V1.0' : runId === 'RUN002' ? 'V1.1' : 'V1.2',
    position: {
      x: Math.round((Math.random() - 0.5) * 2000) / 100,
      y: Math.round((Math.random() - 0.5) * 1000) / 100,
      z: Math.round((Math.random() - 0.5) * 500) / 100,
    },
    originalFields: {
      物料名称: '示例材料',
      状态: '进行中',
      来源: 'HY-2024-015',
    },
    lockedFields: ['source', 'processingStatus'],
    involvedInCollision: i % 11 === 0,
  }));
}

export const mockMaterials: MaterialItem[] = [
  ...generateMaterials('RUN001', 42, 0),
  ...generateMaterials('RUN002', 45, 3),
  ...generateMaterials('RUN003', 48, 7),
];

export const mockCollisions: CollisionPoint[] = [
  {
    collisionId: 'COL-001',
    runId: 'RUN001',
    confidence: 'high',
    involvedMaterialIds: ['MAT-RUN001-001', 'MAT-RUN001-005'],
    originalQuote: '雨水斗与主管连接处存在15mm间隙未处理',
    noteParagraphRef: '第3条',
    deduplicationHash: 0x5f3759df,
  },
  {
    collisionId: 'COL-002',
    runId: 'RUN001',
    confidence: 'medium',
    involvedMaterialIds: ['MAT-RUN001-012', 'MAT-RUN001-018'],
    originalQuote: '天沟接缝处密封胶未按图施工',
    noteParagraphRef: '第7条',
    deduplicationHash: 0x2a5ae099,
  },
  {
    collisionId: 'COL-003',
    runId: 'RUN002',
    confidence: 'high',
    involvedMaterialIds: ['MAT-RUN002-003', 'MAT-RUN002-010'],
    originalQuote: '伸缩节安装方向与水流方向相反',
    noteParagraphRef: '第12条',
    deduplicationHash: 0x1b851838,
  },
  {
    collisionId: 'COL-004',
    runId: 'RUN003',
    confidence: 'low',
    involvedMaterialIds: ['MAT-RUN003-022', 'MAT-RUN003-030'],
    originalQuote: '检查口位置低于设计标高50mm',
    noteParagraphRef: '第15条',
    deduplicationHash: 0x4c72391f,
  },
];

export const mockMeetingNotes: MeetingNote[] = [
  {
    noteId: 'NOTE001',
    noteNumber: 'HY-2024-015',
    title: '屋面排水系统技术交底会议纪要',
    meetingDate: '2024-12-10',
    paragraphs: [
      { index: 1, rawText: '本工程屋面排水系统采用虹吸式雨水排放方案。', extractedFields: { 方案: '虹吸式' }, matchedStandards: [] },
      { index: 2, rawText: 'DN100排水立管共计12根，沿结构柱内侧布置。', extractedFields: { 规格: 'DN100', 数量: '12根' }, matchedStandards: ['materialName', 'materialType'] },
      { index: 3, rawText: '雨水斗与主管连接处存在15mm间隙未处理，需二次打胶。', extractedFields: { 问题: '间隙未处理' }, matchedStandards: ['processingStatus'] },
    ],
  },
];
