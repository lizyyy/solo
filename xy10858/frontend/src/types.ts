export type SynonymStatus = 'draft' | 'pending_review' | 'approved' | 'published' | 'rejected' | 'rollbacked';
export type BatchStatus = 'pending' | 'reviewing' | 'approved' | 'publishing' | 'published' | 'failed' | 'rollbacking' | 'rollbacked';

export interface SynonymGroup {
  id: string;
  name: string;
  synonyms: string[];
  application_scope: string;
  status: SynonymStatus;
  created_at: number;
  updated_at: number;
  created_by: string;
  version: number;
  description?: string;
}

export interface SynonymVersion {
  id: string;
  group_id: string;
  version: number;
  synonyms: string[];
  application_scope: string;
  created_at: number;
  created_by: string;
  description?: string;
}

export interface PublishBatch {
  id: string;
  name: string;
  status: BatchStatus;
  created_at: number;
  updated_at: number;
  created_by: string;
  approved_by?: string;
  approved_at?: number;
  published_at?: number;
  rollbacked_at?: number;
  rollbacked_by?: string;
  error_message?: string;
  description?: string;
}

export interface BatchItem {
  id: string;
  batch_id: string;
  group_id: string;
  version: number;
  status: BatchStatus;
  error_message?: string;
  group_name: string;
}

export interface TestQuery {
  id: string;
  group_id: string;
  query: string;
  expected_hits?: number;
  actual_hits_before?: number;
  actual_hits_after?: number;
  created_at: number;
}

export interface HitChange {
  id: string;
  batch_id: string;
  group_id: string;
  query: string;
  hits_before: number;
  hits_after: number;
  change_percent: number;
  created_at: number;
}

export interface RollbackAudit {
  id: string;
  batch_id: string;
  group_id: string;
  rollback_from_version: number;
  rollback_to_version: number;
  reason: string;
  created_at: number;
  created_by: string;
}

export interface StatusHistory {
  id: string;
  entity_type: 'synonym_group' | 'publish_batch';
  entity_id: string;
  from_status?: string;
  to_status: string;
  reason?: string;
  created_at: number;
  created_by: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export const statusColors: Record<string, string> = {
  draft: '#6b7280',
  pending_review: '#f59e0b',
  approved: '#10b981',
  published: '#3b82f6',
  rejected: '#ef4444',
  rollbacked: '#8b5cf6',
  pending: '#6b7280',
  reviewing: '#f59e0b',
  publishing: '#3b82f6',
  failed: '#ef4444',
  rollbacking: '#8b5cf6'
};

export const statusLabels: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审批',
  approved: '已审批',
  published: '已发布',
  rejected: '已驳回',
  rollbacked: '已回滚',
  pending: '待处理',
  reviewing: '复核中',
  publishing: '发布中',
  failed: '发布失败',
  rollbacking: '回滚中'
};
