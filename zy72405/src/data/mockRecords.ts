import { ShortageRecord, ContractSnapshot, ChangeLog, TrackAlias } from '@/types';

export const mockSnapshots: ContractSnapshot[] = [
  {
    id: 'snap-001',
    fileHash: 'a1b2c3d4e5f6',
    fileName: '2024夏季巡演合同页01.png',
    uploadedAt: '2024-06-01T10:00:00.000Z',
    uploadedBy: '许老师',
    contentFingerprint: 'fp-001'
  }
];

export const mockRecords: ShortageRecord[] = [
  {
    id: 'rec-001',
    snapshotId: 'snap-001',
    originalLineNumber: 1,
    originalContent: '第1行 夜曲 缺货5张 备注：正常预售',
    trackName: '夜曲',
    standardTrackName: '夜曲',
    shortageQuantity: 5,
    status: 'confirmed',
    currentNote: '正常预售',
    isBoundaryCase: false,
    confirmedBy: '许老师',
    createdAt: '2024-06-01T10:05:00.000Z',
    updatedAt: '2024-06-01T14:30:00.000Z'
  },
  {
    id: 'rec-002',
    snapshotId: 'snap-001',
    originalLineNumber: 2,
    originalContent: '第2行 月光奏鸣曲 缺货3张',
    trackName: '月光奏鸣曲',
    standardTrackName: '月光奏鸣曲',
    shortageQuantity: 3,
    status: 'confirmed',
    currentNote: '',
    isBoundaryCase: false,
    confirmedBy: '许老师',
    createdAt: '2024-06-01T10:05:00.000Z',
    updatedAt: '2024-06-01T14:30:00.000Z'
  },
  {
    id: 'rec-003',
    snapshotId: 'snap-001',
    originalLineNumber: 3,
    originalContent: '第3行 致爱丽丝 已消耗2张 备注：学员请假1课时',
    trackName: '致爱丽丝',
    standardTrackName: '致爱丽丝',
    shortageQuantity: 2,
    status: 'review_needed',
    currentNote: '学员请假1课时，被算进已消耗，待巡演统筹复核',
    isBoundaryCase: true,
    boundaryType: '请假课时被算进已消耗',
    createdAt: '2024-06-01T10:05:00.000Z',
    updatedAt: '2024-06-02T09:15:00.000Z'
  },
  {
    id: 'rec-004',
    snapshotId: 'snap-001',
    originalLineNumber: 4,
    originalContent: '第4行 小星星变奏曲 缺货8张',
    trackName: '小星星变奏曲',
    standardTrackName: '小星星变奏曲',
    shortageQuantity: 8,
    status: 'pending',
    currentNote: '',
    isBoundaryCase: false,
    createdAt: '2024-06-01T10:05:00.000Z',
    updatedAt: '2024-06-01T10:05:00.000Z'
  },
  {
    id: 'rec-005',
    snapshotId: 'snap-001',
    originalLineNumber: 5,
    originalContent: '第5行 匈牙利舞曲 缺货1张 备注：补课课时算入',
    trackName: '匈牙利舞曲',
    standardTrackName: '匈牙利舞曲',
    shortageQuantity: 1,
    status: 'review_needed',
    currentNote: '补课课时算入，待复核',
    isBoundaryCase: true,
    boundaryType: '请假课时被算进已消耗',
    createdAt: '2024-06-01T10:05:00.000Z',
    updatedAt: '2024-06-02T09:15:00.000Z'
  },
  {
    id: 'rec-006',
    snapshotId: 'snap-001',
    originalLineNumber: 6,
    originalContent: '第6行 天鹅湖 缺货6张',
    trackName: '天鹅湖',
    standardTrackName: '天鹅湖组曲',
    shortageQuantity: 6,
    status: 'alias_mapped',
    currentNote: '已匹配别名：天鹅湖 → 天鹅湖组曲',
    isBoundaryCase: false,
    createdAt: '2024-06-01T10:05:00.000Z',
    updatedAt: '2024-06-03T11:20:00.000Z'
  }
];

export const mockChangeLogs: ChangeLog[] = [
  {
    id: 'log-001',
    recordId: 'rec-003',
    fieldName: 'status',
    oldValue: 'pending',
    newValue: 'alias_mapped',
    operator: '许老师',
    changedAt: '2024-06-01T14:30:00.000Z',
    changeReason: '匹配曲目别名'
  },
  {
    id: 'log-002',
    recordId: 'rec-003',
    fieldName: 'status',
    oldValue: 'alias_mapped',
    newValue: 'review_needed',
    operator: 'system',
    changedAt: '2024-06-02T09:15:00.000Z',
    changeReason: '检测到边界场景：请假课时被算进已消耗，自动标记待巡演统筹复核'
  },
  {
    id: 'log-003',
    recordId: 'rec-003',
    fieldName: 'isBoundaryCase',
    oldValue: 'false',
    newValue: 'true',
    operator: 'system',
    changedAt: '2024-06-02T09:15:00.000Z',
    changeReason: '边界规则检测'
  },
  {
    id: 'log-004',
    recordId: 'rec-003',
    fieldName: 'currentNote',
    oldValue: '',
    newValue: '学员请假1课时，被算进已消耗，待巡演统筹复核',
    operator: 'system',
    changedAt: '2024-06-02T09:15:00.000Z',
    changeReason: '边界场景自动标记'
  },
  {
    id: 'log-005',
    recordId: 'rec-006',
    fieldName: 'standardTrackName',
    oldValue: '',
    newValue: '天鹅湖组曲',
    operator: '许老师',
    changedAt: '2024-06-03T11:20:00.000Z',
    changeReason: '补看曲目别名表后更新标准曲目名'
  },
  {
    id: 'log-006',
    recordId: 'rec-006',
    fieldName: 'status',
    oldValue: 'pending',
    newValue: 'alias_mapped',
    operator: '许老师',
    changedAt: '2024-06-03T11:20:00.000Z',
    changeReason: '别名匹配完成'
  }
];

export const mockAliases: TrackAlias[] = [
  { id: 'alias-001', standardName: '夜曲', aliasName: 'Nocturne', addedAt: '2024-06-03T10:00:00.000Z', addedBy: '许老师' },
  { id: 'alias-002', standardName: '月光奏鸣曲', aliasName: 'Moonlight Sonata', addedAt: '2024-06-03T10:00:00.000Z', addedBy: '许老师' },
  { id: 'alias-003', standardName: '致爱丽丝', aliasName: 'Für Elise', addedAt: '2024-06-03T10:00:00.000Z', addedBy: '许老师' },
  { id: 'alias-004', standardName: '天鹅湖组曲', aliasName: '天鹅湖', addedAt: '2024-06-03T10:00:00.000Z', addedBy: '许老师' },
  { id: 'alias-005', standardName: '匈牙利舞曲', aliasName: 'Hungarian Dance', addedAt: '2024-06-03T10:00:00.000Z', addedBy: '许老师' }
];
