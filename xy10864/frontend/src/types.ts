export interface Timeline {
  _id: string;
  timestamp: string;
  event: string;
  operator: string;
  description?: string;
}

export interface Evidence {
  _id: string;
  type: 'log' | 'screenshot' | 'document' | 'link';
  title: string;
  url: string;
  description?: string;
  uploadedBy: string;
}

export interface AffectedInterface {
  _id: string;
  name: string;
  method?: string;
  path?: string;
  affectedCount: number;
  errorRate: number;
  customerImpact: string;
}

export interface ActionItem {
  _id: string;
  title: string;
  description?: string;
  assignee: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'high' | 'medium' | 'low';
  dueDate?: string;
  completedAt?: string;
}

export interface ReviewConclusion {
  rootCause: string;
  rootCauseCategory?: string;
  impactSummary: string;
  lessonsLearned: string;
  improvementMeasures: string[];
  reviewedBy: string;
  reviewedAt: string;
}

export interface CompensationRecord {
  _id: string;
  type: string;
  description: string;
  operator: string;
  result?: string;
  executedAt: string;
}

export interface Incident {
  _id: string;
  incidentId: string;
  title: string;
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'detecting' | 'verifying' | 'fixing' | 'monitoring' | 'reviewing' | 'archived';
  startTime: string;
  endTime?: string;
  detectedBy: string;
  owner: string;
  affectedInterfaces: AffectedInterface[];
  evidences: Evidence[];
  timelines: Timeline[];
  actionItems: ActionItem[];
  reviewConclusion?: ReviewConclusion;
  compensationRecords: CompensationRecord[];
  failureReasons: string[];
  tags: string[];
  archivedAt?: string;
  archivedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export const statusLabels: Record<string, string> = {
  detecting: '发现中',
  verifying: '验证中',
  fixing: '修复中',
  monitoring: '监控中',
  reviewing: '复盘',
  archived: '已归档',
};

export const severityLabels: Record<string, string> = {
  critical: '致命',
  high: '严重',
  medium: '中等',
  low: '轻微',
};

export const actionStatusLabels: Record<string, string> = {
  pending: '待处理',
  in_progress: '进行中',
  completed: '已完成',
  cancelled: '已取消',
};
