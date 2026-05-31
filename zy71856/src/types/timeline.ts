export type EventType = 'video' | 'operation' | 'score' | 'abnormal' | 'manual';
export type EventStatus = 'normal' | 'pending' | 'confirmed' | 'rejected';
export type EventSource = 'auto' | 'manual' | 'import';

export type AbnormalType = 'drag_lost' | 'view_reset' | 'step_skipped' | 'late_arrival' | 'duplicate';
export type EvidenceType = 'video' | 'classroom' | 'manual' | 'attachment';

export interface VideoMark {
  videoId: string;
  startTime: number;
  endTime?: number;
  thumbnail?: string;
}

export interface ScoreItem {
  id: string;
  name: string;
  maxScore: number;
  score: number;
  criteria: string;
  comment?: string;
}

export interface AbnormalMark {
  id: string;
  eventId: string;
  type: AbnormalType;
  description: string;
  confirmed: boolean;
  confirmedAt?: number;
  confirmedBy?: string;
  originalEvidence?: any;
}

export interface EvidenceLink {
  id: string;
  eventId: string;
  type: EvidenceType;
  url: string;
  description: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

export interface TimelineEvent {
  id: string;
  sessionId?: string;
  timestamp: number;
  type: EventType;
  title: string;
  description: string;
  status: EventStatus;
  source: EventSource;
  operator?: string;
  videoMark?: VideoMark;
  evidenceLinks: EvidenceLink[];
  scoreItem?: ScoreItem;
  abnormalMark?: AbnormalMark;
  metadata?: Record<string, any>;
  version: number;
  lastModified: number;
}

export interface TimelineFilter {
  types: EventType[];
  statuses: EventStatus[];
  startTime?: number;
  endTime?: number;
  keyword?: string;
  onlyAbnormal?: boolean;
}

export interface TimelineState {
  events: TimelineEvent[];
  selectedEventId: string | null;
  currentTime: number;
  filter: TimelineFilter;
  isLoading: boolean;
}

export const ABNORMAL_TYPE_LABELS: Record<AbnormalType, string> = {
  drag_lost: '拖拽状态丢失',
  view_reset: '视角重置',
  step_skipped: '步骤被跳过',
  late_arrival: '晚到附件',
  duplicate: '重复记录'
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  video: '视频标记',
  operation: '操作记录',
  score: '评分项',
  abnormal: '异常事件',
  manual: '人工确认'
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  normal: '正常',
  pending: '待确认',
  confirmed: '已确认',
  rejected: '已驳回'
};

export const EVIDENCE_TYPE_LABELS: Record<EvidenceType, string> = {
  video: '视频证据',
  classroom: '课堂记录',
  manual: '人工确认',
  attachment: '附件材料'
};
