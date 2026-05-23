export type SourceType = 'order_calendar' | 'cleaning_group' | 'maintenance_note' | 'approval_email' | 'supplier_statement';

export type DirtyType = 
  | 'missing_fields'
  | 'cross_day'
  | 'name_change'
  | 'amount_conflict'
  | 'quantity_conflict'
  | 'duplicate_record';

export type RecordStatus = 'pending' | 'processed' | 'dirty' | 'reconciled' | 'archived';

export interface BaseRecord {
  id: string;
  sourceType: SourceType;
  sourceId: string;
  factId: string;
  rawData: string;
  status: RecordStatus;
  dirtyTypes: DirtyType[];
  processingNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrderCalendar {
  orderId: string;
  roomId: string;
  guestName: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  isContinuousStay: boolean;
  linenChangeRequired: boolean;
  specialRequests?: string;
}

export interface CleaningMessage {
  messageId: string;
  roomId: string;
  cleanerName: string;
  scheduledDate: string;
  scheduledTime?: string;
  cleaningType: 'daily' | 'checkout' | 'linen_change' | 'deep_clean';
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  completedAt?: string;
  qualityScore?: number;
  issuesReported?: string[];
}

export interface MaintenanceNote {
  noteId: string;
  roomId: string;
  reportedBy: string;
  reportedAt: string;
  issueType: 'plumbing' | 'electrical' | 'furniture' | 'appliance' | 'other';
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'reported' | 'assigned' | 'in_progress' | 'resolved' | 'cancelled';
  resolvedAt?: string;
  resolution?: string;
}

export interface ApprovalEmail {
  emailId: string;
  requestType: 'refund' | 'discount' | 'upgrade' | 'maintenance' | 'other';
  requester: string;
  approver?: string;
  requestedAt: string;
  approvedAt?: string;
  status: 'pending' | 'approved' | 'rejected';
  amount?: number;
  reason: string;
  relatedOrderId?: string;
  relatedRoomId?: string;
}

export interface SupplierStatement {
  statementId: string;
  supplierName: string;
  periodStart: string;
  periodEnd: string;
  items: StatementItem[];
  totalAmount: number;
  status: 'draft' | 'submitted' | 'verified' | 'paid' | 'disputed';
}

export interface StatementItem {
  itemId: string;
  description: string;
  roomId?: string;
  date?: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface FactRecord {
  factId: string;
  roomId: string;
  date: string;
  orderInfo?: OrderCalendar;
  cleaningInfo?: CleaningMessage;
  maintenanceInfo?: MaintenanceNote[];
  approvalInfo?: ApprovalEmail[];
  reconciliationStatus: 'matched' | 'mismatch' | 'pending';
  mismatchReasons?: string[];
  verifiedAmount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface DirtyRecord {
  id: string;
  recordId: string;
  sourceType: SourceType;
  dirtyType: DirtyType;
  fieldName?: string;
  originalValue?: string;
  expectedValue?: string;
  description: string;
  resolution?: string;
  resolved: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface AuditLog {
  id: string;
  factId: string;
  action: string;
  oldValue?: string;
  newValue?: string;
  operator: string;
  timestamp: string;
  source: string;
}
