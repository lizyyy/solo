import type { MaterialFile, ChangeRecord, ProofreadIssue, ProofreadTask, FilterState, ScreenRange } from '@/types';

const generateId = () => Math.random().toString(36).substring(2, 11);

export const mockFiles: MaterialFile[] = [
  {
    id: generateId(),
    name: '展板主文案.txt',
    type: 'text',
    content: '2024春季新品发布会\n主题：科技创新 引领未来\n时间：2024年3月15日\n地点：上海国际会议中心',
    uploadTime: Date.now() - 86400000 * 3,
    version: 'v1.0',
  },
  {
    id: generateId(),
    name: '色卡配置.json',
    type: 'color',
    content: JSON.stringify({
      primary: '#1e3a5f',
      secondary: '#3b82f6',
      accent: '#f97316',
      background: '#ffffff',
    }),
    uploadTime: Date.now() - 86400000 * 2,
    version: 'v1.1',
  },
  {
    id: generateId(),
    name: '版式说明.md',
    type: 'layout',
    content: '# 展板版式说明\n\n## 布局\n- 顶部：Logo区域\n- 中部：主标题和副标题\n- 底部：联系信息和二维码',
    uploadTime: Date.now() - 86400000,
    version: 'v1.0',
  },
];

export const mockChanges: ChangeRecord[] = [
  {
    id: generateId(),
    fileId: mockFiles[0].id,
    field: 'title',
    oldValue: '2024春季新品发布会',
    newValue: '2024春季新品发布会\n特邀嘉宾：李明博士',
    type: 'material',
    category: '补充信息',
    severity: 'low',
    description: '新增了特邀嘉宾信息',
    suggestion: '这是补充材料，不影响原有结论，可以直接通过',
    timestamp: Date.now() - 3600000,
  },
  {
    id: generateId(),
    fileId: mockFiles[0].id,
    field: 'location',
    oldValue: '上海国际会议中心',
    newValue: '北京国际会议中心',
    type: 'conclusion',
    category: '地点变更',
    severity: 'high',
    description: '活动地点从上海改为北京',
    suggestion: '这是重要的结论变更，需要确认印刷供应商是否已更新所有物料',
    timestamp: Date.now() - 7200000,
  },
  {
    id: generateId(),
    fileId: mockFiles[1].id,
    field: 'accent',
    oldValue: '#f97316',
    newValue: '#ef4444',
    type: 'conclusion',
    category: '色值调整',
    severity: 'medium',
    description: '强调色从橙色改为红色',
    suggestion: '色值有调整，请核对设计稿，确保印刷效果符合预期',
    timestamp: Date.now() - 1800000,
  },
  {
    id: generateId(),
    fileId: mockFiles[2].id,
    field: 'layout',
    oldValue: '底部：联系信息和二维码',
    newValue: '底部：联系信息、二维码和主办方Logo',
    type: 'material',
    category: '版式补充',
    severity: 'low',
    description: '底部区域新增主办方Logo',
    suggestion: '属于版式补充内容，检查设计文件是否已包含该元素',
    timestamp: Date.now() - 900000,
  },
];

export const mockIssues: ProofreadIssue[] = [
  {
    id: generateId(),
    fileId: mockFiles[0].id,
    type: 'warning',
    title: '时间格式不一致',
    message: '我注意到活动时间写的是"2024年3月15日"，但其他地方用的是"03/15"这种格式。',
    suggestion: '建议统一用"2024年3月15日"的写法，更正式也更容易读',
    location: { line: 3, field: 'time' },
    resolved: false,
  },
  {
    id: generateId(),
    fileId: mockFiles[1].id,
    type: 'error',
    title: '色值可能有问题',
    message: '红色 #ef4444 看起来有点太亮了，在印刷时可能会有色差。',
    suggestion: '建议用稍微深一点的红色，比如 #dc2626，打印出来效果会更稳',
    location: { field: 'accent' },
    resolved: false,
  },
  {
    id: generateId(),
    fileId: mockFiles[2].id,
    type: 'info',
    title: '版式说明更新了',
    message: '版式说明里加了主办方Logo的位置要求，记得告诉设计师加上。',
    suggestion: '可以在下次和设计师核对的时候提一下这个更新',
    location: { line: 7 },
    resolved: true,
  },
];

export const defaultFilters: FilterState = {
  searchText: '',
  changeTypes: [],
  severities: [],
  resolvedStatus: 'all',
  sortBy: 'timestamp',
};

export const defaultScreenRange: ScreenRange = {
  scrollTop: 0,
  scrollHeight: 0,
  visibleStart: 0,
  visibleEnd: 0,
  timestamp: Date.now(),
};

export const createMockTask = (): ProofreadTask => ({
  id: generateId(),
  name: '春季发布会展板校对',
  status: 'completed',
  files: mockFiles,
  changes: mockChanges,
  issues: mockIssues,
  screenRange: defaultScreenRange,
  filters: defaultFilters,
  createdAt: Date.now() - 86400000,
  updatedAt: Date.now(),
});
