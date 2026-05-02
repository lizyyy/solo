export interface AuditLog {
  id: string;
  entityType: 'BLOOD_BAG' | 'APPLICATION' | 'WARD' | 'SYSTEM';
  entityId: string;
  action: string;
  previousState: Record<string, unknown> | null;
  newState: Record<string, unknown> | null;
  changes: string[];
  operator: string;
  operatorRole: string;
  timestamp: string;
  ipAddress: string | null;
  userAgent: string | null;
  notes: string | null;
}

export interface CreateAuditLogInput {
  entityType: 'BLOOD_BAG' | 'APPLICATION' | 'WARD' | 'SYSTEM';
  entityId: string;
  action: string;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  changes?: string[];
  operator: string;
  operatorRole?: string;
  ipAddress?: string;
  userAgent?: string;
  notes?: string;
}

export interface AuditLogFilter {
  entityType?: 'BLOOD_BAG' | 'APPLICATION' | 'WARD' | 'SYSTEM';
  entityId?: string;
  action?: string;
  operator?: string;
  startDate?: string;
  endDate?: string;
}
