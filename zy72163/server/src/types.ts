export interface Location {
  id: number;
  name: string;
  normalizedName: string;
  address?: string;
  lat: number;
  lng: number;
  street?: string;
  district?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ResidentFeedback {
  id: number;
  locationId: number;
  feedbackNo?: string;
  reporter?: string;
  phone?: string;
  feedbackDate: string;
  content: string;
  rawContent: string;
  source: string;
  status: 'pending' | 'processing' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface InspectionPhoto {
  id: number;
  locationId: number;
  feedbackId?: number;
  fileName: string;
  filePath: string;
  uploadedBy?: string;
  uploadedAt: string;
  description?: string;
}

export interface StreetNote {
  id: number;
  streetName: string;
  content: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlanVersion {
  id: number;
  locationId: number;
  version: string;
  title: string;
  description?: string;
  pruningType: string;
  estimatedDate?: string;
  actualDate?: string;
  contractor?: string;
  cost?: number;
  status: 'draft' | 'approved' | 'in_progress' | 'completed' | 'cancelled';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  parentVersionId?: number;
}

export interface Report {
  id: number;
  planVersionId: number;
  locationId: number;
  reportNo: string;
  title: string;
  content: string;
  pruningDetails?: string;
  issuesFound?: string;
  followUpActions?: string;
  status: 'draft' | 'submitted' | 'approved' | 'archived';
  generatedBy: string;
  generatedAt: string;
  updatedAt: string;
}

export interface DataConflict {
  id: number;
  locationId: number;
  feedbackId?: number;
  relatedFeedbackId?: number;
  conflictType: 'location_name' | 'pruning_suggestion' | 'status' | 'content_discrepancy' | 'priority' | 'other';
  description: string;
  feedbackValue?: string;
  existingValue?: string;
  suggestedAction: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LocationAlias {
  id: number;
  locationId: number;
  alias: string;
  isManual: boolean;
  createdAt: string;
}

export type AuditLogAction = 'create' | 'update' | 'delete' | 'merge' | 'import' | 'resolve_conflict';

export interface AuditLog {
  id: number;
  entityType: string;
  entityId: number;
  action: AuditLogAction;
  oldValue?: string;
  newValue?: string;
  performedBy: string;
  performedAt: string;
}
