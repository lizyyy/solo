import type {
  Component,
  MaterialRevision,
  MaterialItem,
  Remark,
  Anomaly,
  TimelineEvent,
  ReviewConclusion,
} from '@/types';

const T0 = new Date('2026-06-09T09:00:00+08:00').toISOString();
const T1 = new Date('2026-06-09T10:15:00+08:00').toISOString();
const T2 = new Date('2026-06-09T11:40:00+08:00').toISOString();
const T3 = new Date('2026-06-09T14:05:00+08:00').toISOString();
const T4 = new Date('2026-06-09T15:20:00+08:00').toISOString();
const T5 = new Date('2026-06-09T16:50:00+08:00').toISOString();

export const MOCK_COMPONENTS: Component[] = [
  { id: 'cmp-v1', name: 'M1-竖梃-01', category: '竖梃', zone: '东立面', floor: 2, positionX: -2.2, positionY: 0, positionZ: 0, sizeW: 0.12, sizeH: 4.2, sizeD: 0.18, isAnomaly: true },
  { id: 'cmp-v2', name: 'M1-竖梃-02', category: '竖梃', zone: '东立面', floor: 2, positionX: 2.2, positionY: 0, positionZ: 0, sizeW: 0.12, sizeH: 4.2, sizeD: 0.18 },
  { id: 'cmp-v3', name: 'M2-竖梃-01', category: '竖梃', zone: '东立面', floor: 3, positionX: -2.2, positionY: 4.2, positionZ: 0, sizeW: 0.12, sizeH: 4.2, sizeD: 0.18 },
  { id: 'cmp-v4', name: 'M2-竖梃-02', category: '竖梃', zone: '东立面', floor: 3, positionX: 2.2, positionY: 4.2, positionZ: 0, sizeW: 0.12, sizeH: 4.2, sizeD: 0.18 },
  { id: 'cmp-h1', name: 'M1-横梃-01', category: '横梃', zone: '东立面', floor: 2, positionX: 0, positionY: -1.4, positionZ: 0, sizeW: 4.52, sizeH: 0.08, sizeD: 0.15 },
  { id: 'cmp-h2', name: 'M1-横梃-02', category: '横梃', zone: '东立面', floor: 2, positionX: 0, positionY: 1.4, positionZ: 0, sizeW: 4.52, sizeH: 0.08, sizeD: 0.15 },
  { id: 'cmp-h3', name: 'M2-横梃-01', category: '横梃', zone: '东立面', floor: 3, positionX: 0, positionY: 2.8, positionZ: 0, sizeW: 4.52, sizeH: 0.08, sizeD: 0.15 },
  { id: 'cmp-h4', name: 'M2-横梃-02', category: '横梃', zone: '东立面', floor: 3, positionX: 0, positionY: 5.6, positionZ: 0, sizeW: 4.52, sizeH: 0.08, sizeD: 0.15 },
  { id: 'cmp-g1', name: 'G1-玻璃-01', category: '玻璃', zone: '东立面', floor: 2, positionX: 0, positionY: 0, positionZ: -0.01, sizeW: 2.0, sizeH: 2.6, sizeD: 0.024 },
  { id: 'cmp-g2', name: 'G2-玻璃-02', category: '玻璃', zone: '东立面', floor: 3, positionX: 0, positionY: 4.2, positionZ: -0.01, sizeW: 2.0, sizeH: 2.6, sizeD: 0.024 },
  { id: 'cmp-c1', name: 'C1-角码-01', category: '连接件', zone: '东立面', floor: 2, positionX: -2.2, positionY: -1.4, positionZ: 0, sizeW: 0.12, sizeH: 0.12, sizeD: 0.1 },
  { id: 'cmp-c2', name: 'C2-角码-02', category: '连接件', zone: '东立面', floor: 2, positionX: 2.2, positionY: 1.4, positionZ: 0, sizeW: 0.12, sizeH: 0.12, sizeD: 0.1 },
];

export const MOCK_REVISIONS: MaterialRevision[] = [
  { id: 'rev-old', version: '旧版', reviewDate: '2026-06-05', reviewer: '王工', sourceFile: '幕墙材料送审表-20260528-旧版.xlsx', linkedEventId: 'evt-rev-old' },
  { id: 'rev-new', version: '新版', reviewDate: '2026-06-08', reviewer: '李工', sourceFile: '幕墙材料送审表-20260608-新版.xlsx', linkedEventId: 'evt-rev-new' },
];

export const MOCK_MATERIAL_OLD: MaterialItem[] = [
  { id: 'm1', revisionId: 'rev-old', componentId: 'cmp-v1', materialName: '铝合金竖梃 6063-T5', submissionSpec: '120×180×4mm', constructionSpec: '120×180×4mm', isMismatch: false, source: '送审表' },
  { id: 'm2', revisionId: 'rev-old', componentId: 'cmp-g1', materialName: 'Low-E中空玻璃', submissionSpec: '6Low-E+12A+6 钢化', constructionSpec: '8Low-E+12A+8 钢化夹胶', isMismatch: true, source: '送审表' },
  { id: 'm3', revisionId: 'rev-old', componentId: 'cmp-c1', materialName: '不锈钢角码 304', submissionSpec: '80×80×6mm', constructionSpec: '80×80×6mm', isMismatch: false, source: '送审表' },
  { id: 'm4', revisionId: 'rev-old', componentId: 'cmp-h1', materialName: '铝合金横梃 6063-T5', submissionSpec: '150×80×3.5mm', constructionSpec: '150×80×3mm', isMismatch: true, source: '送审表' },
  { id: 'm5', revisionId: 'rev-old', componentId: 'cmp-v2', materialName: '铝合金竖梃 6063-T5', submissionSpec: '氟碳喷涂 3涂', constructionSpec: '粉末喷涂', isMismatch: true, source: '送审表' },
  { id: 'm6', revisionId: 'rev-old', componentId: 'cmp-g2', materialName: 'Low-E中空玻璃', submissionSpec: '6Low-E+12A+6 钢化', constructionSpec: '6Low-E+12A+6 钢化', isMismatch: false, source: '送审表' },
  { id: 'm7', revisionId: 'rev-old', componentId: 'cmp-h3', materialName: '铝合金横梃 6063-T5', submissionSpec: '150×80×3.5mm', constructionSpec: '150×80×3.5mm', isMismatch: false, source: '送审表' },
  { id: 'm8', revisionId: 'rev-old', componentId: 'cmp-c2', materialName: '不锈钢螺栓 A2-70', submissionSpec: 'M10×30', constructionSpec: 'M10×30', isMismatch: false, source: '送审表' },
];

export const MOCK_MATERIAL_NEW: MaterialItem[] = [
  { id: 'm1n', revisionId: 'rev-new', componentId: 'cmp-v1', materialName: '铝合金竖梃 6063-T5', submissionSpec: '120×180×4mm', constructionSpec: '120×180×4mm', isMismatch: false, source: '送审表' },
  { id: 'm2n', revisionId: 'rev-new', componentId: 'cmp-g1', materialName: 'Low-E中空玻璃', submissionSpec: '8Low-E+12A+8 钢化夹胶', constructionSpec: '8Low-E+12A+8 钢化夹胶', isMismatch: false, source: '送审表' },
  { id: 'm3n', revisionId: 'rev-new', componentId: 'cmp-c1', materialName: '不锈钢角码 304', submissionSpec: '80×80×6mm', constructionSpec: '80×80×6mm', isMismatch: false, source: '送审表' },
  { id: 'm4n', revisionId: 'rev-new', componentId: 'cmp-h1', materialName: '铝合金横梃 6063-T5', submissionSpec: '150×80×3.5mm', constructionSpec: '150×80×3.5mm', isMismatch: false, source: '送审表' },
  { id: 'm5n', revisionId: 'rev-new', componentId: 'cmp-v2', materialName: '铝合金竖梃 6063-T5', submissionSpec: '氟碳喷涂 3涂', constructionSpec: '粉末喷涂', isMismatch: true, source: '送审表' },
  { id: 'm6n', revisionId: 'rev-new', componentId: 'cmp-g2', materialName: 'Low-E中空玻璃', submissionSpec: '6Low-E+12A+6 钢化', constructionSpec: '6Low-E+12A+6 钢化', isMismatch: false, source: '送审表' },
  { id: 'm7n', revisionId: 'rev-new', componentId: 'cmp-h3', materialName: '铝合金横梃 6063-T5', submissionSpec: '150×80×3.5mm', constructionSpec: '150×80×3.5mm', isMismatch: false, source: '送审表' },
  { id: 'm8n', revisionId: 'rev-new', componentId: 'cmp-c2', materialName: '不锈钢螺栓 A2-70', submissionSpec: 'M10×30', constructionSpec: 'M10×30', isMismatch: false, source: '送审表' },
];

export const MOCK_REMARKS: Remark[] = [
  {
    id: 'rmk-oral-1',
    type: '口头',
    content: '张工现场电话确认：玻璃厚度按新版送审执行，旧版厚度为笔误',
    author: '岑（BIM协调）',
    createdAt: T3,
    linkedMaterialId: 'm2',
    linkedTimelineEventId: 'evt-remark-oral1',
    affectsConclusion: true,
  },
  {
    id: 'rmk-oral-2',
    type: '口头',
    content: '与车间确认：横梃壁厚3mm可满足结构计算，后续补变更单',
    author: '岑（BIM协调）',
    createdAt: T3,
    linkedMaterialId: 'm4',
    linkedTimelineEventId: 'evt-remark-oral2',
    affectsConclusion: true,
  },
  {
    id: 'rmk-houbu-1',
    type: '后补',
    content: '设计补充：竖梃M1-竖梃-02表面处理改为粉末喷涂，与合同清单一致；原送审"氟碳喷涂"为提报错误，已通知供应商纠正',
    author: '岑（BIM协调）',
    createdAt: T4,
    linkedMaterialId: 'm5',
    linkedTimelineEventId: 'evt-remark-houbu1',
    affectsConclusion: true,
  },
];

export const MOCK_ANOMALIES: Anomaly[] = [
  {
    id: 'anom-1',
    type: '坐标偏移',
    componentId: 'cmp-v1',
    offsetX: 0,
    offsetY: 15,
    offsetZ: 0,
    severity: '一般',
    description: 'M1-竖梃-01 Y方向定位偏移 +15mm，超出规范允许±10mm 范围，建议现场复核',
    detectedAt: T2,
    linkedTimelineEventId: 'evt-anom-1',
  },
];

export const MOCK_TIMELINE: TimelineEvent[] = [
  { id: 'evt-init', type: '导入', timestamp: T0, title: '项目初始导入', description: '载入幕墙节点模型 v2.3', operator: '系统' },
  { id: 'evt-rev-old', type: '送审表', timestamp: T1, title: '旧版材料送审表', description: '导入：幕墙材料送审表-20260528-旧版.xlsx · 8条记录', linkedObjectId: 'rev-old', operator: '岑（BIM协调）' },
  { id: 'evt-anom-1', type: '异常', timestamp: T2, title: '检出坐标偏移', description: 'M1-竖梃-01 偏移+15mm', linkedObjectId: 'anom-1', operator: '系统' },
  { id: 'evt-remark-oral1', type: '备注', timestamp: T3, title: '口头备注：玻璃厚度', description: '张工电话确认', linkedObjectId: 'rmk-oral-1', operator: '岑（BIM协调）' },
  { id: 'evt-remark-oral2', type: '备注', timestamp: T3, title: '口头备注：横梃壁厚', description: '车间确认可满足', linkedObjectId: 'rmk-oral-2', operator: '岑（BIM协调）' },
  { id: 'evt-remark-houbu1', type: '备注', timestamp: T4, title: '后补备注：竖梃表面处理', description: '设计补充说明', linkedObjectId: 'rmk-houbu-1', operator: '岑（BIM协调）' },
  { id: 'evt-review-1', type: '复核', timestamp: T5, title: '首轮复核完成', description: '生成复核结论：有条件通过', linkedObjectId: 'concl-1', operator: '岑（BIM协调）' },
];

export const MOCK_CONCLUSIONS: ReviewConclusion[] = [
  {
    id: 'concl-1',
    timelineEventId: 'evt-review-1',
    status: '有条件通过',
    description: '经送审表对齐、口头备注及后补说明修正后，除竖梃M1-竖梃-01坐标偏移待现场复核外，其余条目均与施工口径一致。建议：1. 现场复核竖梃定位；2. 横梃壁厚变更单尽快归档；3. 竖梃表面处理变更同步供应商。',
    generatedAt: T5,
    affectedMaterialIds: ['m2', 'm4', 'm5'],
    affectedRemarkIds: ['rmk-oral-1', 'rmk-oral-2', 'rmk-houbu-1'],
    affectedAnomalyIds: ['anom-1'],
  },
];
