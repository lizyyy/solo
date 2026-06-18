import type { TimelineEvent } from '@/types';

export const mockTimelineEvents: TimelineEvent[] = [
  {
    id: 'evt-001',
    recordId: 'rec-002',
    eventTime: '2026-06-15T09:30:00',
    eventType: 'create',
    operator: '系统自动采集',
    description: '船上传感器自动采集原始数据，浊度 15.6 NTU',
    detail: { rawValue: 15.6, source: '传感器#A03' },
  },
  {
    id: 'evt-002',
    recordId: 'rec-002',
    eventTime: '2026-06-15T09:35:00',
    eventType: 'clean',
    operator: '系统自动处理',
    description: '自动执行数据清洗流水线，检测到传感器漂移',
    detail: { driftAmount: 1.2, stepsCompleted: 5 },
  },
  {
    id: 'evt-003',
    recordId: 'rec-002',
    eventTime: '2026-06-15T10:15:00',
    eventType: 'drift',
    operator: '老何',
    description: '老何确认漂移数据，选择放行并标注需后续重测验证',
    detail: { decision: 'release', reason: '数值在合理范围内，待重测确认' },
  },
  {
    id: 'evt-004',
    recordId: 'rec-002',
    eventTime: '2026-06-15T14:30:00',
    eventType: 'note',
    operator: '老何',
    description: '添加后补备注：下午重测数值回落到11.3，确认疏浚影响',
    detail: { supplementaryNote: '下午14:00重测一次，数值回落到11.3，确认疏浚影响' },
  },
  {
    id: 'evt-005',
    recordId: 'rec-002',
    eventTime: '2026-06-16T08:20:00',
    eventType: 'status_change',
    operator: '老何',
    description: '状态从待处理变更为待补件，缺少现场照片和重测原始数据',
    detail: { from: 'pending', to: 'supplement', missingEvidence: ['现场照片', '重测原始数据'] },
  },
];

export const getTimelineByRecordId = (recordId: string): TimelineEvent[] => {
  return mockTimelineEvents
    .filter(e => e.recordId === recordId)
    .sort((a, b) => new Date(a.eventTime).getTime() - new Date(b.eventTime).getTime());
};
