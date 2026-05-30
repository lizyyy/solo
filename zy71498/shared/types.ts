export type EmotionTag = 'happy' | 'sad' | 'energetic' | 'calm' | 'romantic' | 'angry' | 'nostalgic' | 'hopeful';

export type TrackStatus = 'active' | 'removed' | 'pending';

export type ConflictType = 'algorithm_vs_manual' | 'copyright_vs_recommend' | 'manual_lost' | 'version_mismatch';

export type ChangeType = 'new' | 'updated' | 'unchanged' | 'removed';

export type EventType = 'algorithm_tag' | 'manual_tag' | 'copyright_remove' | 'recommend' | 'manual_correction' | 'review_note';

export interface Track {
  id: string;
  trackId: string;
  title: string;
  artist: string;
  album: string;
  algorithmTags: EmotionTag[];
  manualTags: EmotionTag[];
  copyrightStatus: 'active' | 'removed';
  isRecommended: boolean;
  status: TrackStatus;
  createdAt: string;
  updatedAt: string;
  importBatchId: string;
}

export interface TimelineEvent {
  id: string;
  trackId: string;
  eventType: EventType;
  timestamp: string;
  operator: string;
  description: string;
  evidence?: string;
  metadata?: Record<string, any>;
}

export interface Conflict {
  id: string;
  trackId: string;
  conflictType: ConflictType;
  severity: 'low' | 'medium' | 'high';
  description: string;
  resolved: boolean;
  resolvedAt?: string;
  resolver?: string;
  resolutionNote?: string;
  createdAt: string;
}

export interface ImportBatch {
  id: string;
  fileName: string;
  importedAt: string;
  operator: string;
  totalCount: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  status: 'processing' | 'completed' | 'failed';
}

export interface TrackDetail extends Track {
  timeline: TimelineEvent[];
  conflicts: Conflict[];
}

export interface ReviewReport {
  id: string;
  generatedAt: string;
  operator: string;
  batchIds: string[];
  summary: {
    totalTracks: number;
    conflictTracks: number;
    resolvedConflicts: number;
    unresolvedConflicts: number;
    copyrightRemoved: number;
    manualCorrections: number;
  };
  tracks: Track[];
  conflicts: Conflict[];
  changes: {
    trackId: string;
    changeType: ChangeType;
    changes: Record<string, { old: any; new: any }>;
  }[];
}

export interface DashboardStats {
  totalTracks: number;
  conflictCount: number;
  resolvedCount: number;
  copyrightRemoved: number;
  pendingCount: number;
  emotionDistribution: Record<EmotionTag, { algorithm: number; manual: number }>;
}

export interface ImportPreview {
  new: Track[];
  updated: Track[];
  unchanged: Track[];
}

export interface ImportResult extends ImportBatch {
  preview: ImportPreview;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export const EMOTION_TAG_LABELS: Record<EmotionTag, string> = {
  happy: '欢快',
  sad: '忧伤',
  energetic: '活力',
  calm: '平静',
  romantic: '浪漫',
  angry: '愤怒',
  nostalgic: '怀旧',
  hopeful: '希望',
};

export const EMOTION_TAG_COLORS: Record<EmotionTag, string> = {
  happy: '#FBBF24',
  sad: '#3B82F6',
  energetic: '#F97316',
  calm: '#06B6D4',
  romantic: '#EC4899',
  angry: '#EF4444',
  nostalgic: '#8B5CF6',
  hopeful: '#10B981',
};

export const CONFLICT_TYPE_LABELS: Record<ConflictType, string> = {
  algorithm_vs_manual: '算法vs人工标签',
  copyright_vs_recommend: '版权下架仍推荐',
  manual_lost: '人工修正丢失',
  version_mismatch: '版本不匹配',
};

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  algorithm_tag: '算法标签',
  manual_tag: '人工标签',
  copyright_remove: '版权下架',
  recommend: '推荐记录',
  manual_correction: '人工修正',
  review_note: '复核备注',
};

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  new: '新增',
  updated: '更新',
  unchanged: '无变化',
  removed: '删除',
};
