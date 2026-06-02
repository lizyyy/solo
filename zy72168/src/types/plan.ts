export interface BypassRoute {
  id: string;
  name: string;
  description: string;
  startPoint: string;
  endPoint: string;
  estimatedTime: string;
  applicableTime: string;
}

export interface BusinessSuggestion {
  id: string;
  content: string;
  priority: 'high' | 'medium' | 'low';
  targetRole: string;
}

export interface PlanVersion {
  id: string;
  version: string;
  pointIds: string[];
  title: string;
  content: string;
  bypassRoutes: BypassRoute[];
  suggestions: BusinessSuggestion[];
  changeReason: string;
  createdBy: string;
  createdAt: string;
  previousVersionId?: string;
  nextVersionId?: string;
  isActive: boolean;
}

export interface DiffResult {
  field: string;
  oldValue: string;
  newValue: string;
  changeType: 'added' | 'removed' | 'modified';
}

export interface TraceNode {
  id: string;
  type: 'point' | 'feedback' | 'plan';
  title: string;
  time: string;
  relation: string;
}
