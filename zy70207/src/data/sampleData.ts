import type { AppState, Stall, Issue, Rectification, InspectionRecord } from '../types';

const now = new Date();
const oneDay = 24 * 60 * 60 * 1000;

export const sampleStalls: Stall[] = [
  { id: 'stall-001', name: '老地方烧烤', row: 0, col: 0, owner: '张师傅', category: '烧烤', status: 'has_issue' },
  { id: 'stall-002', name: '香辣小龙虾', row: 0, col: 1, owner: '李老板', category: '海鲜', status: 'normal' },
  { id: 'stall-003', name: '特色串串香', row: 0, col: 2, owner: '王姐', category: '串串', status: 'pending_rectification' },
  { id: 'stall-004', name: '快乐铁板烧', row: 0, col: 3, owner: '赵哥', category: '铁板烧', status: 'normal' },
  { id: 'stall-005', name: '老王馄饨', row: 1, col: 0, owner: '老王', category: '小吃', status: 'rectified' },
  { id: 'stall-006', name: '重庆小面', row: 1, col: 1, owner: '陈师傅', category: '面食', status: 'normal' },
  { id: 'stall-007', name: '油炸臭豆腐', row: 1, col: 2, owner: '刘阿姨', category: '油炸', status: 'has_issue' },
  { id: 'stall-008', name: '手抓饼', row: 1, col: 3, owner: '孙老板', category: '小吃', status: 'normal' },
  { id: 'stall-009', name: '奶茶小站', row: 2, col: 0, owner: '周小妹', category: '饮品', status: 'normal' },
  { id: 'stall-010', name: '卤肉卷', row: 2, col: 1, owner: '吴哥', category: '小吃', status: 'normal' },
  { id: 'stall-011', name: '烤冷面', row: 2, col: 2, owner: '郑师傅', category: '小吃', status: 'normal' },
  { id: 'stall-012', name: '炸鸡汉堡', row: 2, col: 3, owner: '冯老板', category: '西式', status: 'pending_rectification' },
];

export const sampleIssues: Issue[] = [
  {
    id: 'issue-001',
    stallId: 'stall-001',
    type: 'oil',
    description: '摊位地面有大量油污，未及时清理',
    severity: 'high',
    discoveredAt: new Date(now.getTime() - 2 * oneDay).toISOString(),
    discoveredBy: '巡查员张磊',
  },
  {
    id: 'issue-002',
    stallId: 'stall-001',
    type: 'fire',
    description: '明火操作区离易燃物过近，存在安全隐患',
    severity: 'medium',
    discoveredAt: new Date(now.getTime() - 2 * oneDay).toISOString(),
    discoveredBy: '巡查员张磊',
  },
  {
    id: 'issue-003',
    stallId: 'stall-003',
    type: 'oil',
    description: '灶台油污堆积，影响食品安全',
    severity: 'medium',
    discoveredAt: new Date(now.getTime() - 5 * oneDay).toISOString(),
    discoveredBy: '巡查员李明',
  },
  {
    id: 'issue-004',
    stallId: 'stall-005',
    type: 'oil',
    description: '地面轻微油污，需要定期清洁',
    severity: 'low',
    discoveredAt: new Date(now.getTime() - 7 * oneDay).toISOString(),
    discoveredBy: '巡查员王芳',
  },
  {
    id: 'issue-005',
    stallId: 'stall-007',
    type: 'fire',
    description: '油炸设备附近有纸箱堆放，存在火灾隐患',
    severity: 'high',
    discoveredAt: new Date(now.getTime() - 1 * oneDay).toISOString(),
    discoveredBy: '巡查员张磊',
  },
  {
    id: 'issue-006',
    stallId: 'stall-012',
    type: 'fire',
    description: '炸锅温度过高，操作不当',
    severity: 'medium',
    discoveredAt: new Date(now.getTime() - 4 * oneDay).toISOString(),
    discoveredBy: '巡查员李明',
  },
];

export const sampleRectifications: Rectification[] = [
  {
    id: 'rect-001',
    issueId: 'issue-001',
    stallId: 'stall-001',
    status: 'pending',
    deadline: new Date(now.getTime() + 1 * oneDay).toISOString(),
  },
  {
    id: 'rect-002',
    issueId: 'issue-002',
    stallId: 'stall-001',
    status: 'in_progress',
    deadline: new Date(now.getTime() + 1 * oneDay).toISOString(),
    rectificationMethod: '正在调整明火操作区位置',
  },
  {
    id: 'rect-003',
    issueId: 'issue-003',
    stallId: 'stall-003',
    status: 'in_progress',
    deadline: new Date(now.getTime() + 2 * oneDay).toISOString(),
    rectificationMethod: '已安排深度清洁，预计明天完成',
    notes: '摊主配合度高',
  },
  {
    id: 'rect-004',
    issueId: 'issue-004',
    stallId: 'stall-005',
    status: 'verified',
    deadline: new Date(now.getTime() - 4 * oneDay).toISOString(),
    completedAt: new Date(now.getTime() - 5 * oneDay).toISOString(),
    verifiedAt: new Date(now.getTime() - 3 * oneDay).toISOString(),
    rectificationMethod: '加强日常清洁，每天收摊后彻底清洁地面',
    notes: '整改效果良好',
  },
  {
    id: 'rect-005',
    issueId: 'issue-005',
    stallId: 'stall-007',
    status: 'pending',
    deadline: new Date(now.getTime() + 1 * oneDay).toISOString(),
  },
  {
    id: 'rect-006',
    issueId: 'issue-006',
    stallId: 'stall-012',
    status: 'completed',
    deadline: new Date(now.getTime() - 1 * oneDay).toISOString(),
    completedAt: new Date(now.getTime() - 2 * oneDay).toISOString(),
    rectificationMethod: '调整炸锅温控，安装温度报警器',
  },
];

export const sampleInspectionRecords: InspectionRecord[] = [
  {
    id: 'inspection-001',
    stallId: 'stall-001',
    issues: sampleIssues.filter((i) => i.stallId === 'stall-001'),
    rectifications: sampleRectifications.filter((r) => r.stallId === 'stall-001'),
    inspectedAt: new Date(now.getTime() - 2 * oneDay).toISOString(),
    inspectedBy: '巡查员张磊',
  },
  {
    id: 'inspection-002',
    stallId: 'stall-003',
    issues: sampleIssues.filter((i) => i.stallId === 'stall-003'),
    rectifications: sampleRectifications.filter((r) => r.stallId === 'stall-003'),
    inspectedAt: new Date(now.getTime() - 5 * oneDay).toISOString(),
    inspectedBy: '巡查员李明',
  },
  {
    id: 'inspection-003',
    stallId: 'stall-005',
    issues: sampleIssues.filter((i) => i.stallId === 'stall-005'),
    rectifications: sampleRectifications.filter((r) => r.stallId === 'stall-005'),
    inspectedAt: new Date(now.getTime() - 7 * oneDay).toISOString(),
    inspectedBy: '巡查员王芳',
  },
  {
    id: 'inspection-004',
    stallId: 'stall-007',
    issues: sampleIssues.filter((i) => i.stallId === 'stall-007'),
    rectifications: sampleRectifications.filter((r) => r.stallId === 'stall-007'),
    inspectedAt: new Date(now.getTime() - 1 * oneDay).toISOString(),
    inspectedBy: '巡查员张磊',
  },
  {
    id: 'inspection-005',
    stallId: 'stall-012',
    issues: sampleIssues.filter((i) => i.stallId === 'stall-012'),
    rectifications: sampleRectifications.filter((r) => r.stallId === 'stall-012'),
    inspectedAt: new Date(now.getTime() - 4 * oneDay).toISOString(),
    inspectedBy: '巡查员李明',
  },
];

export const getSampleData = (): AppState => ({
  stalls: sampleStalls,
  issues: sampleIssues,
  rectifications: sampleRectifications,
  inspectionRecords: sampleInspectionRecords,
});
